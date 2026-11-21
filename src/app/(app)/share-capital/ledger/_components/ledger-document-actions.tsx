"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { FileDown, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/store";
import { useBrandingStore } from "@/store/branding-store";
import { applyChrome, loadLogoDataUrl } from "@/app/(app)/reports/_lib/report-chrome";
import type { ReportDocument } from "@/app/(app)/reports/_lib/types";
import { subsidiaryLedgerDocument, type SubsidiaryLedgerInput } from "../_lib/subsidiary-ledger-document";

const ReportPrintJob = dynamic(() => import("@/app/(app)/reports/_components/report-print-job"), { ssr: false });

type Action = "pdf" | "print";

/**
 * Download PDF and Print Document for one member's subsidiary ledger. Both
 * render the same report document, so the PDF and the printout match: the
 * cooperative's letterhead, the member, the range, opening balance, every
 * entry with its running balance, totals and the closing balance.
 */
export function LedgerDocumentActions({
  input,
  disabledReason,
}: {
  /** Null until the member's entries and period figures have loaded. */
  input: SubsidiaryLedgerInput | null;
  /** Why the document can't be made right now (e.g. the list was cut short). */
  disabledReason?: string | null;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [printDoc, setPrintDoc] = useState<ReportDocument | null>(null);
  const user = useAuthStore((s) => s.user);
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  const disabled = !input || !!disabledReason || busy !== null;

  async function run(action: Action) {
    if (!input) return;
    setBusy(action);
    try {
      const doc = await applyChrome(subsidiaryLedgerDocument(input), {
        logoUrl,
        logoData: await loadLogoDataUrl(logoUrl),
        preparedBy: user?.full_name ?? user?.username ?? null,
        branchLabel: null,
      });
      if (action === "pdf") {
        const { exportReportToPdf } = await import("@/app/(app)/reports/_lib/report-pdf");
        exportReportToPdf(doc);
        notifySuccess("Subsidiary ledger downloaded.");
        setBusy(null);
      } else {
        // Busy until the print dialog closes.
        setPrintDoc(doc);
      }
    } catch (err) {
      notifyError(err, "Could not prepare the ledger document. Please try again.");
      setBusy(null);
    }
  }

  const printDone = useCallback(() => {
    setPrintDoc(null);
    setBusy(null);
  }, []);

  return (
    <div className="flex items-center gap-2" title={disabledReason ?? undefined}>
      <Button variant="outline" size="sm" className="h-8" disabled={disabled} onClick={() => run("pdf")}>
        {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        Download PDF
      </Button>
      <Button variant="outline" size="sm" className="h-8" disabled={disabled} onClick={() => run("print")}>
        {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        Print Document
      </Button>
      {printDoc && <ReportPrintJob doc={printDoc} onDone={printDone} />}
    </div>
  );
}
