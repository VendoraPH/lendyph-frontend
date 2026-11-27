import { formatCurrency } from "@/lib/format";
import type { SavingsAccountsResponse, TimeDepositsResponse } from "@/types";

const DASH = "—";

/**
 * The member profile's Savings tab headline cards, each the server's own
 * figure (`meta.totals` and `meta.stats` of the member's accounts and time
 * deposits). A figure the server didn't send reads "—"; nothing is added up.
 */
export function savingsTabCards(
  accounts: Pick<SavingsAccountsResponse["meta"], "totals" | "stats"> | undefined,
  deposits: Pick<TimeDepositsResponse["meta"], "totals" | "stats"> | undefined,
): Array<{ label: string; value: string }> {
  const count = (n: number | undefined | null) => (n == null ? DASH : String(n));
  return [
    { label: "Savings balance", value: accounts?.totals ? formatCurrency(accounts.totals.total_balance) : DASH },
    { label: "Savings accounts", value: count(accounts?.totals?.account_count) },
    { label: "Active time deposits", value: deposits?.stats ? String(deposits.stats.active ?? 0) : DASH },
    { label: "Maturing in 30 days", value: count(deposits?.totals?.maturing_30_days) },
  ];
}
