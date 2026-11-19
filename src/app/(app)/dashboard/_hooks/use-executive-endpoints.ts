import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/api-error";
import { executiveDashboardService } from "@/services/executive-dashboard.service";
import type { ExecutiveBranches, ExecutiveOverview, ExecutiveQuery } from "@/types/executive-dashboard";
import { LOADING, type Source } from "../_lib/executive-data";

/** A source that failed, with the server's words for why. */
export type EndpointSource<T> = Source<T> | { state: "refused"; message: string };

export interface ExecutiveEndpoints {
  overview: EndpointSource<ExecutiveOverview>;
  branches: EndpointSource<ExecutiveBranches>;
}

interface Stored {
  key: string;
  overview?: EndpointSource<ExecutiveOverview>;
  branches?: EndpointSource<ExecutiveBranches>;
}

function failed(err: unknown): { state: "refused"; message: string } {
  return { state: "refused", message: getErrorMessage(err, "We couldn't load the executive dashboard. Please try again.") };
}

/**
 * The cards and the branch table, from the dashboard's own endpoints (EB-D1),
 * in parallel. Each result is stored with the request it answers, so a figure
 * for an old period or branch never shows under a new one. A refusal (a
 * custom range the server won't take, a branch outside the user's) keeps the
 * server's words.
 */
export function useExecutiveEndpoints(query: ExecutiveQuery, reloadCount: number): ExecutiveEndpoints {
  const key = `${JSON.stringify(query)}|${reloadCount}`;
  const [stored, setStored] = useState<Stored>({ key: "" });

  useEffect(() => {
    let cancelled = false;
    const request: ExecutiveQuery = JSON.parse(key.slice(0, key.lastIndexOf("|")));
    const settle = (part: Partial<Stored>) => {
      if (!cancelled) setStored((prev) => ({ ...(prev.key === key ? prev : {}), key, ...part }));
    };
    executiveDashboardService
      .overview(request)
      .then((data) => settle({ overview: { state: "ready", data } }))
      .catch((err: unknown) => settle({ overview: failed(err) }));
    executiveDashboardService
      .branches(request)
      .then((data) => settle({ branches: { state: "ready", data } }))
      .catch((err: unknown) => settle({ branches: failed(err) }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const current = stored.key === key ? stored : { key };
  return { overview: current.overview ?? LOADING, branches: current.branches ?? LOADING };
}
