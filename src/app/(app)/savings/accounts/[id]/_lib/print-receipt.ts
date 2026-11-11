import { toast } from "sonner";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";
import { buildSavingsReceiptDoc, type ReceiptTransactionType } from "@/lib/printables/templates/savings-receipt";
import type { SavingsAccount, SavingsTransaction } from "@/types";

/**
 * Open the receipt for one deposit or withdrawal in a new tab to print, and
 * say how it went. The line is the server's as listed or as posted, so
 * nothing is fetched but the letterhead.
 */
export function printSavingsReceipt(
  account: SavingsAccount,
  txn: SavingsTransaction & { type: ReceiptTransactionType },
): Promise<void> {
  return resolvePrintableOrg()
    .then((org) => {
      const doc = applyPrintChrome(buildSavingsReceiptDoc(account, txn, { org }));
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
