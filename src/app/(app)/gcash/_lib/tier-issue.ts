/**
 * Why a Cash In / Cash Out dialog can't work out a charge, if it can't.
 *
 * Every one of these leaves the charge unresolved and the Record button
 * disabled, so the dialog must say which one it is rather than show a bare "—".
 * - `load_error`: the tier request failed; retrying may fix it.
 * - `no_tiers`: none are configured, so no amount can resolve a charge.
 * - `out_of_range`: the amount falls outside every tier (beyond the last
 *   one, below the first, or in a gap between two).
 */
export type GCashTierIssue = "load_error" | "no_tiers" | "out_of_range";

interface TierIssueInput {
  loading: boolean;
  error: string | null;
  tierCount: number;
  amount: number;
  charge: number | null;
}

export function gcashTierIssue({
  loading,
  error,
  tierCount,
  amount,
  charge,
}: TierIssueInput): GCashTierIssue | null {
  if (loading) return null;
  if (error) return "load_error";
  if (tierCount === 0) return "no_tiers";
  if (Number.isFinite(amount) && amount > 0 && charge === null) {
    return "out_of_range";
  }
  return null;
}
