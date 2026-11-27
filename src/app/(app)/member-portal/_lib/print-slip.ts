import { toast } from "sonner";
import type { PortalCodeSlip } from "@/types/portal-admin";
import { portalAddress, slipHtml } from "./access-rules";

/**
 * Open the code slip in a new tab to print. The slip carries the portal's path
 * only; the full address is built from this app's own origin. Nothing is kept:
 * the tab holds the only copy once the dialog closes.
 */
export function printCodeSlip(slip: PortalCodeSlip, cooperative: string): void {
  const html = slipHtml(slip, portalAddress(window.location.origin, slip.portal_path), cooperative);
  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
  } catch {
    win = null;
  }
  if (!win) {
    toast.error("Allow pop-ups for this site to print the slip.");
    return;
  }
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } catch {
    toast.error("This browser can't open the slip for printing.");
  }
}
