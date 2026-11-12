import { formatCurrency } from "@/lib/format";
import { parseMoneyInput } from "@/lib/money-input";
import { moneyPostMessage, type MoneyPostResult } from "@/lib/savings/money-post";
import type { SavingsAccount } from "@/types";
import type { ShareCapitalTransferInput, ShareCapitalTransferResult } from "@/types/savings-servicing";

/** The permissions the server checks for a transfer to share capital (gap round S3). */
export const SHARE_CAPITAL_TRANSFER_PERMISSIONS = ["savings:post", "share_capital:create"] as const;

/**
 * Why a transfer to share capital can't be offered on this account, or null.
 * The server checks the member, the branch, the product's rules and the
 * available balance again and answers 422 in words.
 */
export function shareCapitalTransferBlocker(account: Pick<SavingsAccount, "status" | "product">): string | null {
  if (account.product.kind === "time_deposit") return "A time deposit account can't transfer to share capital.";
  if (account.status !== "active") return "Only an active account can transfer to share capital.";
  return null;
}

export type TransferBodyCheck =
  | { ok: true; body: ShareCapitalTransferInput }
  | { ok: false; message: string };

/** The request body from the form: the amount as typed (two decimals, above ₱0.00) and remarks when given. */
export function buildShareCapitalTransferBody(amountRaw: string, remarksRaw: string): TransferBodyCheck {
  const amount = parseMoneyInput(amountRaw, { label: "Transfer amount" });
  if (!amount.ok) return { ok: false, message: amount.message };
  const remarks = remarksRaw.trim();
  if (remarks.length > 500) return { ok: false, message: "The remarks can be at most 500 characters." };
  return { ok: true, body: remarks ? { amount: amount.value, remarks } : { amount: amount.value } };
}

/**
 * What the toast says after the transfer, in words: posted (with the member's
 * new share capital balance when the caller may see it), or sent for
 * approval (the approval tier's outcome, or the reason a checker is needed).
 */
export function shareCapitalTransferOutcome(result: MoneyPostResult<ShareCapitalTransferResult>): {
  title: string;
  description: string;
} {
  if (result.kind === "sent_for_approval") {
    return {
      title: moneyPostMessage(result, ""),
      description: "Nothing moves until it is approved; the amount is reserved on the account meanwhile.",
    };
  }
  const { transaction, share_capital_balance } = result.record;
  const moved = `${formatCurrency(transaction.debit)} moved to share capital (${transaction.reference}).`;
  return {
    title: "Transferred to share capital",
    description:
      share_capital_balance === null
        ? moved
        : `${moved} The member's share capital is now ${formatCurrency(share_capital_balance)}.`,
  };
}
