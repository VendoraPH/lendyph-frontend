import { toast } from "sonner";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";
import { PrintableRefusedError } from "@/lib/printables/refusal";
import type { SavingsDocument } from "./documents";

/**
 * Build the document for one record and open it in a new tab to print. The
 * catalog (and its templates) is loaded on click, so it stays out of the
 * page's bundle.
 */
export async function printSavingsDocument(doc: SavingsDocument, subjectId: number): Promise<void> {
  try {
    const { PRINTABLE_CATALOG } = await import("@/lib/printables/catalog");
    const printable = PRINTABLE_CATALOG.find((p) => p.id === doc.id);
    if (!printable) {
      toast.error(`The ${doc.label.toLowerCase()} isn't available in this version yet.`);
      return;
    }
    const org = await resolvePrintableOrg();
    const built = applyPrintChrome(await printable.build({ subjectId, org }));
    switch (openPrintable(built)) {
      case "opened":
        if (built.incomplete) {
          toast.warning(`${printable.title} opened, but its record couldn't be loaded. Check the details before issuing it.`);
        } else {
          toast.success(`${printable.title} opened in a new tab.`);
        }
        break;
      case "popup_blocked":
        toast.error("Allow pop-ups for this site to print the document.");
        break;
      case "unavailable":
        toast.error("This browser can't open the document for printing.");
        break;
    }
  } catch (err) {
    // A record the server refused (a 422) says why, in its words.
    toast.error(
      err instanceof PrintableRefusedError
        ? err.message
        : `We couldn't prepare the ${doc.label.toLowerCase()}. Please try again.`
    );
  }
}
