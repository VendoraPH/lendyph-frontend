import { toast } from "sonner";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";
import { buildTimeDepositCertificateDoc } from "@/lib/printables/templates/time-deposit-certificate";
import type { TimeDeposit } from "@/types";

/** Open the placement's certificate in a new tab to print, and say how it went. */
export function printTimeDepositCertificate(td: TimeDeposit): Promise<void> {
  return resolvePrintableOrg()
    .then((org) => {
      const doc = applyPrintChrome(buildTimeDepositCertificateDoc(td, { org }));
      switch (openPrintable(doc)) {
        case "opened":
          toast.success("Certificate opened in a new tab.");
          break;
        case "popup_blocked":
          toast.error("Allow pop-ups for this site to print the certificate.");
          break;
        case "unavailable":
          toast.error("This browser can't open the certificate for printing.");
          break;
      }
    })
    .catch(() => {
      toast.error("We couldn't prepare the certificate. Please try again.");
    });
}
