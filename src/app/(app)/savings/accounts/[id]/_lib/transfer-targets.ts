import type { SavingsAccount } from "@/types";

/**
 * The accounts a transfer from `from` may go to: the same member's other
 * accounts in the same branch that can take a deposit (active or dormant).
 * The server refuses anything else (design §10: cross-branch transfers are
 * refused).
 */
export function transferTargets(
  from: Pick<SavingsAccount, "id" | "borrower_id" | "branch_id">,
  accounts: readonly SavingsAccount[],
): SavingsAccount[] {
  return accounts.filter(
    (a) =>
      a.id !== from.id &&
      a.borrower_id === from.borrower_id &&
      a.branch_id === from.branch_id &&
      (a.status === "active" || a.status === "dormant"),
  );
}
