import type { MaturityInstruction, SavingsAccount, SavingsMethod, SettleTimeDepositInput, TimeDeposit } from "@/types";
import { METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "../../_lib/savings-rules";

/**
 * How a time deposit's money can be paid out: into one of the member's own
 * savings accounts (no approval), or over the counter, where cash, bank,
 * GCash or Maya above the first tier waits for approval. Savings comes first
 * when the placement names a payout account.
 */
export function payoutOptions(
  td: Pick<TimeDeposit, "payout_account_id">,
): Array<{ value: SavingsMethod; label: string }> {
  const counter = PAYMENT_METHOD_OPTIONS.map((o) => ({ value: o.value as SavingsMethod, label: o.label }));
  const savings = { value: "savings" as const, label: `Into a ${METHOD_LABELS.savings.toLowerCase()}` };
  return td.payout_account_id ? [savings, ...counter] : [...counter, savings];
}

/**
 * The accounts a payout into savings may go to: the member's own active
 * regular accounts in the placement's branch. The server refuses any other
 * (422 on `payout_account_id`).
 */
export function payoutAccounts(
  td: Pick<TimeDeposit, "borrower_id" | "branch_id">,
  accounts: readonly SavingsAccount[],
): SavingsAccount[] {
  return accounts.filter(
    (a) =>
      a.borrower_id === td.borrower_id &&
      a.branch_id === td.branch_id &&
      a.status === "active" &&
      a.product.kind === "regular",
  );
}

/** The account picked first: the placement's payout account when it's offered, else none. */
export function defaultPayoutAccount(
  td: Pick<TimeDeposit, "payout_account_id">,
  offered: readonly Pick<SavingsAccount, "id">[],
): string {
  return td.payout_account_id && offered.some((a) => a.id === td.payout_account_id) ? String(td.payout_account_id) : "";
}

/** The payout fields: the method, and the account when it goes into savings. */
export function payoutFields(
  method: SavingsMethod,
  accountId: string,
): { payout_method: SavingsMethod; payout_account_id?: number } {
  return method === "savings" && Number(accountId) > 0
    ? { payout_method: method, payout_account_id: Number(accountId) }
    : { payout_method: method };
}

/**
 * `POST …/{id}/settle`. A full rollover pays nothing out, so it sends no
 * payout method; a rollover sends the new placement's instruction.
 */
export function settleBody(
  date: string,
  action: MaturityInstruction,
  payoutMethod: SavingsMethod,
  nextInstruction: MaturityInstruction,
  payoutAccountId = "",
): SettleTimeDepositInput {
  return {
    date,
    action,
    ...(action === "rollover_all" ? {} : payoutFields(payoutMethod, payoutAccountId)),
    ...(action === "payout" ? {} : { next_instruction: nextInstruction }),
  };
}

/** "Interest after maturity (12 days)": a late settlement's extra interest, or a dash when the server couldn't work it out. */
export function postMaturityLabel(td: Pick<TimeDeposit, "post_maturity_days">): string {
  return td.post_maturity_days === null
    ? "Interest after maturity"
    : `Interest after maturity (${td.post_maturity_days} day${td.post_maturity_days === 1 ? "" : "s"})`;
}
