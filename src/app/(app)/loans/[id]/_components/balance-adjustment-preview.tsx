"use client";

import { formatCurrency } from "@/lib/format";
import type { BalanceAdjustmentPreviewView } from "../_lib/balance-adjustment";

interface BalanceAdjustmentPreviewBoxProps {
  id: string;
  /** Something is typed in the target field. */
  typed: boolean;
  /** What is typed is a figure the server accepts. */
  valid: boolean;
  loading: boolean;
  preview: BalanceAdjustmentPreviewView | null;
  error: string | null;
}

/** The server's figures for the target principal typed now. */
export function BalanceAdjustmentPreviewBox({
  id,
  typed,
  valid,
  loading,
  preview,
  error,
}: BalanceAdjustmentPreviewBoxProps) {
  if (!typed) return null;
  return (
    <div id={id} aria-live="polite" className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
      {!valid ? (
        <p className="text-destructive">Enter an amount of zero or more, with up to 2 decimals.</p>
      ) : loading ? (
        <p className="text-muted-foreground">Calculating…</p>
      ) : error !== null || preview === null ? (
        <p className="text-destructive">{error ?? "We couldn't preview this adjustment."}</p>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Current principal</dt>
          <dd className="text-right tabular-nums">{formatCurrency(preview.currentPrincipal)}</dd>
          <dt className="text-muted-foreground">Adjustment</dt>
          <dd className="text-right tabular-nums">{formatCurrency(preview.adjustment)}</dd>
          <dt className="font-medium">Resulting principal</dt>
          <dd className="text-right font-medium tabular-nums">{formatCurrency(preview.resultingPrincipal)}</dd>
          {preview.adjustment === 0 && (
            <dd className="col-span-2 text-xs text-muted-foreground">
              That is already the outstanding principal; there is nothing to adjust.
            </dd>
          )}
        </dl>
      )}
    </div>
  );
}
