"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { readBlobError } from "@/lib/amla/case-api";
import { amlaReportApi } from "@/lib/amla/report-api";
import type { AmlaComplianceReportFilters, AmlaExportFormat } from "@/types/amla-reports";

const FORMATS: readonly { format: AmlaExportFormat; label: string }[] = [
  { format: "pdf", label: "PDF" },
  { format: "xlsx", label: "Excel" },
  { format: "csv", label: "CSV" },
];

interface Props {
  reportKey: string;
  /** The filters of the report on screen, so the file matches what is shown. */
  filters: AmlaComplianceReportFilters;
}

/**
 * The server builds and keeps each export (`amla:export`, 5 a minute), then
 * hands back a signed link bound to the caller, which is downloaded with the
 * session's token.
 */
export function ComplianceReportExports({ reportKey, filters }: Props) {
  const [busy, setBusy] = useState<AmlaExportFormat | null>(null);

  const run = (format: AmlaExportFormat) => {
    setBusy(format);
    amlaReportApi
      .exportReport(reportKey, filters, format)
      .then(async (made) => {
        const file = await amlaReportApi.download(made.download_url);
        saveBlob(file.blob, file.filename ?? `${reportKey}.${format}`);
        notifySuccess(made.is_draft ? "Draft export saved" : "Export saved", made.is_draft ? "The period hasn't ended, so the file is marked draft." : undefined);
      })
      .catch(async (err: unknown) => notifyError(await readBlobError(err), "The report couldn't be exported."))
      .then(() => setBusy(null));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:ml-auto" role="group" aria-label="Export this report">
      {FORMATS.map(({ format, label }) => (
        <Button key={format} type="button" variant="outline" disabled={busy !== null} onClick={() => run(format)}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          {busy === format ? "Exporting…" : label}
        </Button>
      ))}
    </div>
  );
}
