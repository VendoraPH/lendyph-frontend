import { useEffect, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api-error";
import { executiveDashboardService } from "@/services/executive-dashboard.service";
import type { Permission } from "@/types";
import type {
  ExecutiveAttention,
  ExecutiveBranches,
  ExecutiveOverview,
  ExecutiveQuery,
  ExecutiveTrends,
  ExecutiveTurnaround,
  ShareCapitalControl,
} from "@/types/executive-dashboard";
import { LOADING, type Source } from "../_lib/executive-data";

/** A source that failed, with the server's words for why. */
export type EndpointSource<T> = Source<T> | { state: "refused"; message: string };

export interface ExecutiveEndpoints {
  overview: EndpointSource<ExecutiveOverview>;
  branches: EndpointSource<ExecutiveBranches>;
  attention: EndpointSource<ExecutiveAttention>;
  trends: EndpointSource<ExecutiveTrends>;
  turnaround: EndpointSource<ExecutiveTurnaround>;
  shareCapitalControl: EndpointSource<ShareCapitalControl>;
}

type Name = keyof ExecutiveEndpoints;

/** Each endpoint's call, and what it needs beyond `dashboard:analytics` (the page's own gate). */
const ENDPOINTS: Record<Name, { load: (query: ExecutiveQuery) => Promise<unknown>; permissions: Permission[] }> = {
  overview: { load: executiveDashboardService.overview, permissions: [] },
  branches: { load: executiveDashboardService.branches, permissions: [] },
  attention: { load: executiveDashboardService.attention, permissions: [] },
  trends: { load: executiveDashboardService.trends, permissions: ["reports:view"] },
  turnaround: { load: executiveDashboardService.turnaround, permissions: ["reports:view"] },
  shareCapitalControl: { load: executiveDashboardService.shareCapitalControl, permissions: ["accounting:view", "share_capital:view"] },
};

const NAMES = Object.keys(ENDPOINTS) as Name[];

function failed(err: unknown): { state: "refused"; message: string } {
  return { state: "refused", message: getErrorMessage(err, "We couldn't load this part of the executive dashboard. Please try again.") };
}

/**
 * The dashboard's own endpoints (EB-D1 and EB-D2), in parallel, each on its
 * own. One the user lacks the permission for is never asked and reads
 * `denied`. Each result is stored with the request it answers, so a figure for
 * an old period, branch or filter never shows under a new one. A refusal keeps
 * the server's words.
 */
export function useExecutiveEndpoints(query: ExecutiveQuery, reloadCount: number): ExecutiveEndpoints {
  const { can } = usePermission();
  const allowed = NAMES.filter((name) => ENDPOINTS[name].permissions.every((p) => can(p))).join(",");
  const key = `${JSON.stringify(query)}|${reloadCount}|${allowed}`;
  const [stored, setStored] = useState<{ key: string; data: Partial<ExecutiveEndpoints> }>({ key: "", data: {} });

  useEffect(() => {
    let cancelled = false;
    const request: ExecutiveQuery = JSON.parse(key.slice(0, key.indexOf("|")));
    const names = key.slice(key.lastIndexOf("|") + 1).split(",").filter(Boolean) as Name[];
    const settle = (name: Name, source: EndpointSource<unknown>) => {
      if (!cancelled) setStored((prev) => ({ key, data: { ...(prev.key === key ? prev.data : {}), [name]: source } }));
    };
    for (const name of names) {
      ENDPOINTS[name]
        .load(request)
        .then((data) => settle(name, { state: "ready", data }))
        .catch((err: unknown) => settle(name, failed(err)));
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  const loaded = stored.key === key ? stored.data : {};
  const permitted = new Set(allowed.split(","));
  return Object.fromEntries(
    NAMES.map((name) => [name, loaded[name] ?? (permitted.has(name) ? LOADING : { state: "denied" })]),
  ) as unknown as ExecutiveEndpoints;
}
