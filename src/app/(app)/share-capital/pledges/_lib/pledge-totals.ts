import type { Pledge } from "@/types";
import { fetchAllPages, type DrainResult, type PageFetcher } from "@/lib/paginate";
import { toNumber } from "@/lib/report-format";

/**
 * GET /pledges `meta.totals.amount`: the server's sum of pledge amounts over
 * every pledge matching the request's filters. Null when the response carried
 * no readable figure, so the card shows a dash; the rows are never added up.
 */
export function readPledgeTotalAmount(response: unknown): number | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const meta = (response as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;
  const totals = (meta as { totals?: unknown }).totals;
  if (!totals || typeof totals !== "object") return null;
  return toNumber((totals as { amount?: unknown }).amount);
}

/**
 * Every pledge, drained across pages exactly as `pledgeListAll` does, plus
 * the server's total amount from the first page that sent one.
 */
export async function drainPledgesWithTotal(
  fetchPage: PageFetcher,
): Promise<{ drain: DrainResult<Pledge>; totalAmount: number | null }> {
  let totalAmount: number | null = null;
  const drain = await fetchAllPages<Pledge>(async (params) => {
    const response = await fetchPage(params);
    totalAmount ??= readPledgeTotalAmount(response);
    return response;
  });
  return { drain, totalAmount };
}

/**
 * Numbers each request so only the newest one's answer is used. Two quick
 * pledge edits fire two total refreshes; if the older answers last, its total
 * is stale and must be dropped.
 */
export function createLatestGate(): { begin: () => number; isLatest: (id: number) => boolean } {
  let latest = 0;
  return {
    begin: () => {
      latest += 1;
      return latest;
    },
    isLatest: (id) => id === latest,
  };
}
