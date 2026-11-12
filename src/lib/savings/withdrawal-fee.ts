import { formatCurrency } from "@/lib/format";
import type { MoneyString, SavingsTransaction } from "@/types";
import type { SavingsWithdrawalRule } from "@/types/savings-servicing";
import { isNilAmount } from "./amount-text";

/**
 * The excess-withdrawal fee (gap round S1), always the server's figure: a
 * withdrawal's linked `fee` row (`fee_amount`) or an approval's reserved
 * `fee_amount`. The browser lists it beside the amount and adds nothing up.
 */
export function feeOf(record: { fee_amount?: MoneyString | null }): MoneyString | null {
  const fee = record.fee_amount;
  return typeof fee === "string" && fee !== "" && !isNilAmount(fee) ? fee : null;
}

/** "₱500.00 plus a ₱25.00 excess-withdrawal fee", or the amount alone. */
export function withFeeText(amount: MoneyString, fee: MoneyString | null): string {
  return fee ? `${formatCurrency(amount)} plus a ${formatCurrency(fee)} excess-withdrawal fee` : formatCurrency(amount);
}

/** The toast after a posted withdrawal: the amount and its fee. */
export function postedWithdrawalText(txn: Pick<SavingsTransaction, "debit" | "fee_amount" | "balance_after">): string {
  const fee = feeOf(txn);
  return fee
    ? `${formatCurrency(txn.debit)} withdrawn, plus a ${formatCurrency(fee)} excess-withdrawal fee.`
    : `${formatCurrency(txn.debit)} withdrawn.`;
}

/**
 * The product's fee rule, shown before posting. The staff API sends no
 * per-account preview of whether this withdrawal is over the free count, so
 * the dialog states the rule and the server applies it when it posts.
 */
export function withdrawalFeeRuleHint(rule: SavingsWithdrawalRule | null | undefined): string | null {
  const free = rule?.free_withdrawals_per_month;
  if (free === null || free === undefined) return null;
  const count = free === 1 ? "1 free withdrawal a month." : `${free} free withdrawals a month.`;
  const fee = rule?.excess_withdrawal_fee;
  if (fee === null || fee === undefined || fee === "") return `${count} More are refused this month.`;
  return `${count} Each one after that takes a ${formatCurrency(fee)} excess-withdrawal fee; the server applies it when you post.`;
}
