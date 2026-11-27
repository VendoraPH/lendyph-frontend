"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/store";
import { useBrandingStore } from "@/store/branding-store";
import { applyChrome, loadLogoDataUrl } from "@/app/(app)/reports/_lib/report-chrome";
import { executiveDocument, type ExecutiveExportInput } from "../../_lib/executive-export";

type Format = "pdf" | "excel" | "csv";

/**
 * Exports what the dashboard shows through the reports module's exporters.
 * Each exporter is loaded on the click that needs it, so the dashboard never
 * ships jspdf or exceljs to someone who only looks.
 */
export function ExportMenu({
  input,
  branchLabel,
  disabled,
}: {
  /** Null until the server has worked out the period. */
  input: ExecutiveExportInput | null;
  branchLabel: string | null;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<Format | null>(null);
  const user = useAuthStore((s) => s.user);
  const logoUrl = useBrandingStore((s) => s.logoUrl);

  async function run(format: Format) {
    if (!input) return;
    setBusy(format);
    try {
      const doc = await applyChrome(executiveDocument(input), {
        logoUrl,
        logoData: format === "csv" ? null : await loadLogoDataUrl(logoUrl),
        preparedBy: user?.full_name ?? user?.username ?? null,
        branchLabel,
      });
      if (format === "pdf") {
        const { exportReportToPdf } = await import("@/app/(app)/reports/_lib/report-pdf");
        exportReportToPdf(doc);
      } else if (format === "excel") {
        const { exportReportToExcel } = await import("@/app/(app)/reports/_lib/report-excel");
        await exportReportToExcel(doc);
      } else {
        const { exportReportToCsv } = await import("@/app/(app)/reports/_lib/report-csv");
        exportReportToCsv(doc);
      }
      notifySuccess("Dashboard exported.");
    } catch (err) {
      notifyError(err, "Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" disabled={disabled || !input || busy !== null} />}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("pdf")}>PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("excel")}>Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("csv")}>CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
