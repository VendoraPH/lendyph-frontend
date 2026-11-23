"use client";

import { useEffect } from "react";
import { ReportPrintSheet } from "./report-print-sheet";
import type { ReportDocument } from "../_lib/types";

/**
 * Mounts the print sheet, opens the browser's print dialog once it is in the
 * page, and reports back when the dialog closes. Loaded on the Print click, so
 * the report preview stays out of the calling page's bundle:
 *
 *   const ReportPrintJob = dynamic(() => import(".../report-print-job"), { ssr: false });
 */
export default function ReportPrintJob({ doc, onDone }: { doc: ReportDocument; onDone: () => void }) {
  useEffect(() => {
    // `print()` blocks until the dialog closes; the sheet must already be painted.
    const frame = requestAnimationFrame(() => {
      window.print();
      onDone();
    });
    return () => cancelAnimationFrame(frame);
  }, [doc, onDone]);

  return <ReportPrintSheet doc={doc} />;
}
