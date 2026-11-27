import type { ShareCapitalMembersResponse } from "@/types";

/**
 * The dashboard's Share Capital figure: the server's balance over the whole
 * book (`meta.totals.balance` of `GET /share-capital/members`). Nothing is
 * added up here. Null when the server sent no readable figure, never 0.
 */
export function shareCapitalBookBalance(
  response: ShareCapitalMembersResponse | null | undefined,
): number | null {
  const raw: unknown = response?.meta?.totals?.balance;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const balance = Number(raw);
  return Number.isFinite(balance) ? balance : null;
}
