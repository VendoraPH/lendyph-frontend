import { formatCurrency } from "@/lib/format";
import type { MoneyString, SavingsAccount, SavingsTransaction } from "@/types";
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

/** The server's `total_with_fee` (gap round B9), or null when it sent none. */
export function totalWithFeeOf(record: { total_with_fee?: MoneyString | null }): MoneyString | null {
  const total = record.total_with_fee;
  return typeof total === "string" && total !== "" ? total : null;
}

/**
 * "₱500.00 plus a ₱25.00 excess-withdrawal fee, ₱525.00 in all", or the
 * amount alone. The total is the server's `total_with_fee`, left out when it
 * sent none.
 */
export function withFeeText(amount: MoneyString, fee: MoneyString | null, total: MoneyString | null = null): string {
  if (!fee) return formatCurrency(amount);
  const all = total ? `, ${formatCurrency(total)} in all` : "";
  return `${formatCurrency(amount)} plus a ${formatCurrency(fee)} excess-withdrawal fee${all}`;
}

/** The toast after a posted withdrawal: the amount, its fee and the server's total. */
export function postedWithdrawalText(
  txn: Pick<SavingsTransaction, "debit" | "fee_amount" | "balance_after" | "total_with_fee">,
): string {
  const fee = feeOf(txn);
  const total = totalWithFeeOf(txn);
  return fee
    ? `${formatCurrency(txn.debit)} withdrawn, plus a ${formatCurrency(fee)} excess-withdrawal fee${total ? ` (${formatCurrency(total)} in all)` : ""}.`
    : `${formatCurrency(txn.debit)} withdrawn.`;
}

/**
 * The withdrawal dialog's fee line (gap round B9): the account's next fee as
 * the server worked it out (`next_withdrawal_fee`, `free_withdrawals_left` on
 * the account detail). Null means a withdrawal would be refused, said in
 * words. An older server that sends neither field reads the product's rule.
 */
export function nextWithdrawalFeeText(
  account: Partial<Pick<SavingsAccount, "next_withdrawal_fee" | "free_withdrawals_left">>,
  rule: (SavingsWithdrawalRule & { allow_withdrawals?: boolean }) | null | undefined,
): string | null {
  if (account.next_withdrawal_fee === undefined) return withdrawalFeeRuleHint(rule);
  const fee = account.next_withdrawal_fee;
  const left = account.free_withdrawals_left ?? null;
  if (fee === null) {
    if (rule?.allow_withdrawals === false) return "A withdrawal would be refused: this product allows no withdrawals.";
    if (left === 0) {
      return "A withdrawal would be refused today: no free withdrawal is left this month, and the product allows no more.";
    }
    return "A withdrawal would be refused on this account today.";
  }
  if (isNilAmount(fee)) {
    if (left === null) return "Withdrawals on this product are free.";
    return `This withdrawal is free: ${left === 1 ? "1 free withdrawal is" : `${left} free withdrawals are`} left this month.`;
  }
  return `No free withdrawal is left this month, so this withdrawal takes a ${formatCurrency(fee)} excess-withdrawal fee.`;
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
