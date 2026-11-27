import { toast } from "sonner";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";
import { buildSavingsReceiptDoc, type ReceiptTransactionType } from "@/lib/printables/templates/savings-receipt";
import { feeOf } from "@/lib/savings/withdrawal-fee";
import { savingsService } from "@/services";
import type { SavingsAccount, SavingsTransaction } from "@/types";

/**
 * Open the receipt for one deposit or withdrawal in a new tab to print, and
 * say how it went. The line is the server's as listed or as posted. A
 * withdrawal that charged an excess-withdrawal fee also reads its linked fee
 * row, whose balance after is the account's balance once both posted; if that
 * read fails the receipt prints the fee and leaves the balance after blank.
 */
export function printSavingsReceipt(
  account: SavingsAccount,
  txn: SavingsTransaction & { type: ReceiptTransactionType },
): Promise<void> {
  const feeRow =
    txn.type === "withdrawal" && feeOf(txn) && txn.fee_transaction_id
      ? savingsService.transaction(txn.fee_transaction_id).catch(() => null)
      : Promise.resolve(null);
  return Promise.all([resolvePrintableOrg(), feeRow])
    .then(([org, fee]) => {
      const doc = applyPrintChrome(buildSavingsReceiptDoc(account, txn, { org, fee }));
      switch (openPrintable(doc)) {
        case "opened":
          toast.success("Receipt opened in a new tab.");
          break;
        case "popup_blocked":
          toast.error("Allow pop-ups for this site to print the receipt.");
          break;
        case "unavailable":
          toast.error("This browser can't open the receipt for printing.");
          break;
      }
    })
    .catch(() => {
      toast.error("We couldn't prepare the receipt. Please try again.");
    });
}
