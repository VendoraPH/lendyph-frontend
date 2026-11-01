"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PartialRowsTable } from "./partial-rows-table";
import { DueLoansTable } from "./due-loans-table";
import { LoanIssuesList } from "./loan-issues-list";
import { formatCurrency } from "@/lib/format";
import { loanIssues, loansAffected, previewTotals } from "../_lib/auto-pay-view";
import { useAutoPayRunTotals } from "../_hooks/use-auto-pay-run-totals";
import type { AutoPayFilter, AutoPayPreview } from "@/types";

interface ReviewStepProps {
  filter: AutoPayFilter;
  preview: AutoPayPreview;
  includedPartialIds: Set<number>;
  onTogglePartial: (scheduleId: number, included: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
  processing: boolean;
}

export function ReviewStep({
  filter,
  preview,
  includedPartialIds,
  onTogglePartial,
  onBack,
  onConfirm,
  processing,
}: ReviewStepProps) {
  // Every figure is the server's. The run's total for the part-paid rows
  // ticked now comes from the preview asked again with that selection.
  const totals = previewTotals(preview.summary);
  const run = useAutoPayRunTotals(filter, includedPartialIds);
  const loanCount = loansAffected(preview, includedPartialIds);
  const skips = loanIssues(preview.skips);

  return (
    <div className="space-y-6">
      {/* Summary Cards: the server's totals for the loans with full dues */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950/20">
          <p className="text-xl font-bold text-green-700 dark:text-green-300">
            {formatCurrency(totals.principal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total Principal</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-950/20">
          <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
            {formatCurrency(totals.interest)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total Interest</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950/20">
          <p className="text-xl font-bold text-red-700 dark:text-red-300">
            {totals.penalty === null ? "—" : formatCurrency(totals.penalty)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total Penalty</p>
        </div>
        <div className="rounded-lg border p-4 text-center sm:col-span-2">
          <p className="text-xl font-bold">{formatCurrency(totals.amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Total Amount (incl. penalty)</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950/20">
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
            {loanCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Loans Affected</p>
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Totals cover the loans with full dues listed below. The run total adds
        the part-paid periods you include.
      </p>

      {/* The run's total for the current selection, from the server */}
      <div
        aria-live="polite"
        className="rounded-lg border-2 border-brand-orange/40 p-4"
      >
        {run.loading ? (
          <p className="text-sm text-muted-foreground">Working out the run total…</p>
        ) : run.totals === null ? (
          <p className="text-sm text-destructive">{run.error}</p>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Selected part-paid periods</dt>
            <dd className="text-right tabular-nums">{formatCurrency(run.totals.partialTotal)}</dd>
            <dt className="text-base font-semibold">Run total</dt>
            <dd className="text-right text-base font-semibold tabular-nums">
              {formatCurrency(run.totals.grandTotal)}
            </dd>
          </dl>
        )}
      </div>

      <DueLoansTable loans={preview.loans ?? []} totals={totals} />

      {/* Partial Rows Review */}
      {preview.partial_rows.length > 0 && (
        <PartialRowsTable
          rows={preview.partial_rows}
          includedIds={includedPartialIds}
          onToggle={onTogglePartial}
        />
      )}

      <LoanIssuesList
        title="Skipped loans"
        description="Left out of this run."
        issues={skips}
        tone="amber"
      />

      {/* CBS Note */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Compare the totals above with your CBS report before confirming. If
          amounts differ, click Back to review the included accounts.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={processing}
          className="flex-1"
        >
          ← Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={processing || loanCount === 0 || run.totals === null}
          className="flex-1 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          {processing && <Spinner className="mr-2 size-4" />}
          ✓ Run Auto-Pay
        </Button>
      </div>
    </div>
  );
}
