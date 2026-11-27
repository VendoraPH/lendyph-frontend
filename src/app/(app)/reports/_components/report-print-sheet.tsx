"use client";

import { createPortal } from "react-dom";
import { REPORT_PRINT_CLASS, REPORT_PRINT_CSS } from "../_lib/report-print";
import type { ReportDocument } from "../_lib/types";
import { ReportPreview } from "./report-preview";

/**
 * The whole report, as the printer sees it. A direct child of `body`, so printing
 * can drop the rest of the page; hidden on screen. Render it only once a document
 * exists, which is always after a click, so `document` is there.
 */
export function ReportPrintSheet({ doc }: { doc: ReportDocument }) {
  return createPortal(
    <div className={REPORT_PRINT_CLASS}>
      <style>{REPORT_PRINT_CSS}</style>
      <ReportPreview doc={doc} />
    </div>,
    document.body
  );
}
