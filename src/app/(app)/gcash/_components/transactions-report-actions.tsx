"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { gcashService } from "@/services/gcash.service";
import { notifyError, notifySuccess } from "@/lib/notify";
import { allBranchesLabel, branchViewer } from "@/lib/user-branches";
import { useAuthStore } from "@/store";
import { useBrandingStore } from "@/store/branding-store";
import { applyChrome, loadLogoDataUrl } from "@/app/(app)/reports/_lib/report-chrome";
import type { ReportDocument } from "@/app/(app)/reports/_lib/types";
import type { GCashListFilters, GCashTransaction } from "@/types";
import { DATE_RANGE_REVERSED, dateRangeReady, dateRangeReversed, type PartialDates } from "../_lib/date-range";
import {
  gcashTransactionsReport,
  transactionsExportRefusal,
  type GCashTransactionsReportInput,
} from "../_lib/transactions-report";

const ReportPrintJob = dynamic(() => import("@/app/(app)/reports/_components/report-print-job"), { ssr: false });

type Action = "pdf" | "excel" | "print";

/** 100 pages of 100: past any co-op's GCash volume for a range someone prints. */
const EXPORT_MAX_PAGES = 100;

export type TransactionsReportFilters = Pick<GCashTransactionsReportInput, "from" | "to" | "type" | "status">;

/**
 * Download Report (PDF or Excel) and Print Report for the Transactions tab.
 * Each fetches every transaction the tab's filters match, not just the page
 * on screen, with the server's totals, and refuses to go on when the list
 * could not be fetched whole or changed while it was read
 * (`transactionsExportRefusal`), because the document would then not match
 * its totals.
 */
export function TransactionsReportActions({
  filters,
  partialDates = {},
  branchOf,
}: {
  filters: TransactionsReportFilters;
  /** Date inputs typed only in part, which report "" (see `dateRangeReady`). */
  partialDates?: PartialDates;
  branchOf: (row: GCashTransaction) => string;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [printDoc, setPrintDoc] = useState<ReportDocument | null>(null);
  const user = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  // A date still being typed, or a reversed range, makes no report.
  const rangeReady = dateRangeReady(filters.from, filters.to, partialDates);
  const reversed = rangeReady && dateRangeReversed(filters.from, filters.to);
  const invalidRange = !rangeReady || reversed;

  async function run(action: Action) {
    setBusy(action);
    try {
      const params: Omit<GCashListFilters, "page" | "per_page"> = {};
      if (filters.type !== "all") params.type = filters.type;
      if (filters.status !== "all") params.status = filters.status;
      if (filters.from) params.start_date = filters.from;
      if (filters.to) params.end_date = filters.to;
      const drain = await gcashService.listAllTransactions(params, { maxPages: EXPORT_MAX_PAGES });
      const refusal = transactionsExportRefusal(drain);
      if (refusal) {
        notifyError(null, refusal);
        setBusy(null);
        return;
      }
      const report = gcashTransactionsReport({
        ...filters,
        rows: drain.rows,
        total: drain.total,
        totals: drain.totals,
        branchOf,
      });
      const doc = await applyChrome(report, {
        logoUrl,
        logoData: await loadLogoDataUrl(logoUrl),
        preparedBy: user?.full_name ?? user?.username ?? null,
        // The tab has no branch filter: the list is every branch the caller can see.
        branchLabel: allBranchesLabel(branchViewer(user, viewAll)),
      });
      if (action === "print") {
        // Busy until the print dialog closes.
        setPrintDoc(doc);
        return;
      }
      if (action === "pdf") {
        const { exportReportToPdf } = await import("@/app/(app)/reports/_lib/report-pdf");
        exportReportToPdf(doc);
      } else {
        const { exportReportToExcel } = await import("@/app/(app)/reports/_lib/report-excel");
        await exportReportToExcel(doc);
      }
      notifySuccess("GCash transactions report downloaded.");
      setBusy(null);
    } catch (err) {
      notifyError(err, "Could not prepare the report. Please try again.");
      setBusy(null);
    }
  }

  const printDone = useCallback(() => {
    setPrintDoc(null);
    setBusy(null);
  }, []);

  const disabled = busy !== null || invalidRange;
  const spin = <Loader2 className="size-4 animate-spin" />;

  return (
    <div className="flex items-center gap-2" title={reversed ? DATE_RANGE_REVERSED : undefined}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" disabled={disabled} />}>
          {busy === "pdf" || busy === "excel" ? spin : <Download className="size-4" />}
          Download Report
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => run("pdf")}>PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("excel")}>Excel (.xlsx)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" disabled={disabled} onClick={() => run("print")}>
        {busy === "print" ? spin : <Printer className="size-4" />}
        Print Report
      </Button>
      {printDoc && <ReportPrintJob doc={printDoc} onDone={printDone} />}
    </div>
  );
}
