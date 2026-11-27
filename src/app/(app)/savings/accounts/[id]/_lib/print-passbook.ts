import { toast } from "sonner";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";
import { buildSavingsPassbookDoc } from "@/lib/printables/templates/savings-passbook";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";

/**
 * Fetch the account's whole ledger, then open its passbook in a new tab to
 * print, and say how it went. The ledger comes newest first, so if it is
 * longer than `fetchAllPages` will drain, it is the oldest lines that are
 * missing, and the passbook says so.
 */
export function printSavingsPassbook(account: SavingsAccount): Promise<void> {
  return Promise.all([
    resolvePrintableOrg(),
    savingsService.allAccountTransactions(account.id),
  ])
    .then(([org, ledger]) => {
      const doc = applyPrintChrome(
        buildSavingsPassbookDoc(account, ledger.rows, { org, truncated: ledger.truncated }),
      );
      switch (openPrintable(doc)) {
        case "opened":
          toast.success("Passbook opened in a new tab.");
          break;
        case "popup_blocked":
          toast.error("Allow pop-ups for this site to print the passbook.");
          break;
        case "unavailable":
          toast.error("This browser can't open the passbook for printing.");
          break;
      }
    })
    .catch(() => {
      toast.error("We couldn't prepare the passbook. Please try again.");
    });
}
