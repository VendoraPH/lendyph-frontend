"use client";

import { Scale } from "lucide-react";
import { formatCentavos } from "@/lib/accounting/money";
import { cn } from "@/lib/utils";
import type { JournalPreview } from "@/types";
import { balanceStatus, type BalanceTone } from "../_lib/journal-balance";

const TONE_STYLES: Record<BalanceTone, { box: string; icon: string }> = {
  pending: { box: "border-muted bg-muted/30", icon: "text-muted-foreground" },
  empty: { box: "border-muted bg-muted/30", icon: "text-muted-foreground" },
  failed: { box: "border-destructive/30 bg-destructive/5", icon: "text-destructive" },
  balanced: { box: "border-emerald-500/30 bg-emerald-500/5", icon: "text-emerald-600" },
  out: { box: "border-amber-500/30 bg-amber-500/5", icon: "text-amber-600" },
};

/**
 * The balance check under the lines: the server's totals for what is typed,
 * and whether they balance. A dash until the server has answered for these
 * lines.
 */
export function JournalBalancePanel({
  preview,
  failed,
}: {
  preview: JournalPreview | null;
  failed: string | null;
}) {
  const status = balanceStatus(preview, failed);
  const styles = TONE_STYLES[status.tone];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 p-4",
        styles.box,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Scale className={cn("h-5 w-5", styles.icon)} aria-hidden="true" />
        <div>
          <p className="font-medium">{status.title}</p>
          {status.detail && <p className="text-sm text-muted-foreground">{status.detail}</p>}
        </div>
      </div>
      <dl className="flex gap-8 font-mono text-sm">
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Debit</dt>
          <dd className="font-medium">{preview ? formatCentavos(preview.total_debit) : "—"}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Credit</dt>
          <dd className="font-medium">{preview ? formatCentavos(preview.total_credit) : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
