"use client";

import { useEffect } from "react";
import { ReportPrintSheet } from "@/app/(app)/reports/_components/report-print-sheet";
import type { ReportDocument } from "@/app/(app)/reports/_lib/types";

/**
 * Mounts the print sheet, opens the browser's print dialog once it is in the
 * page, and reports back when the dialog closes. Loaded on the Print click, so
 * the report preview stays out of the ledger's bundle.
 */
export default function LedgerPrintJob({ doc, onDone }: { doc: ReportDocument; onDone: () => void }) {
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
