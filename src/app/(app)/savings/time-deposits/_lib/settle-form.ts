import type { MaturityInstruction, SavingsMethod, SettleTimeDepositInput, TimeDeposit } from "@/types";
import { METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "../../_lib/savings-rules";

/**
 * How a time deposit's money can be paid out: over the counter, or into the
 * savings account set at placement. The savings payout needs no approval; a
 * cash, bank, GCash or Maya payout above the first tier waits for one.
 */
export function payoutOptions(
  td: Pick<TimeDeposit, "payout_account_id" | "payout_account_number">,
): Array<{ value: SavingsMethod; label: string }> {
  const counter = PAYMENT_METHOD_OPTIONS.map((o) => ({ value: o.value as SavingsMethod, label: o.label }));
  if (!td.payout_account_id) return counter;
  return [
    {
      value: "savings",
      label: `${METHOD_LABELS.savings}${td.payout_account_number ? ` ${td.payout_account_number}` : ""}`,
    },
    ...counter,
  ];
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
): SettleTimeDepositInput {
  return {
    date,
    action,
    ...(action === "rollover_all" ? {} : { payout_method: payoutMethod }),
    ...(action === "payout" ? {} : { next_instruction: nextInstruction }),
  };
}

/** "Interest after maturity (12 days)": a late settlement's extra interest, or a dash when the server couldn't work it out. */
export function postMaturityLabel(td: Pick<TimeDeposit, "post_maturity_days">): string {
  return td.post_maturity_days === null
    ? "Interest after maturity"
    : `Interest after maturity (${td.post_maturity_days} day${td.post_maturity_days === 1 ? "" : "s"})`;
}
