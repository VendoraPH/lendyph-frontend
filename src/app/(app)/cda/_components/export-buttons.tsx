"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cdaReportToDocument } from "../_lib/report-document";
import type { CdaReport } from "@/types/cda";

type Format = "pdf" | "excel" | "docx";

const LABEL: Record<Format, string> = { pdf: "PDF", excel: "Excel", docx: "Word" };

/**
 * Exports through the reports module's exporters. Each one, and the chrome,
 * is `await import()`ed on click so none of jspdf/exceljs/docx lands in the
 * CDA page bundles.
 */
async function exportAs(format: Format, report: CdaReport, preparedBy: string | null): Promise<void> {
  const { applyChrome } = await import("@/app/(app)/reports/_lib/report-chrome");
  const doc = await applyChrome(cdaReportToDocument(report, new Date().toISOString()), { preparedBy });
  if (format === "pdf") {
    const { exportReportToPdf } = await import("@/app/(app)/reports/_lib/report-pdf");
    exportReportToPdf(doc);
  } else if (format === "excel") {
    const { exportReportToExcel } = await import("@/app/(app)/reports/_lib/report-excel");
    await exportReportToExcel(doc);
  } else {
    const { exportReportToDocx } = await import("@/app/(app)/reports/_lib/report-docx");
    await exportReportToDocx(doc);
  }
}

export function ExportButtons({ report }: { report: CdaReport }) {
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<Format | null>(null);

  function run(format: Format) {
    setBusy(format);
    exportAs(format, report, user?.full_name ?? user?.username ?? null)
      .then(() => notifySuccess(`${LABEL[format]} downloaded`))
      .catch((err: unknown) => notifyError(err, `Could not export ${LABEL[format]}`))
      .finally(() => setBusy(null));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(LABEL) as Format[]).map((format) => (
        <Button key={format} variant="outline" size="sm" onClick={() => run(format)} disabled={busy !== null}>
          <Download className="mr-1 h-4 w-4" />
          {busy === format ? "Exporting…" : LABEL[format]}
        </Button>
      ))}
    </div>
  );
}
