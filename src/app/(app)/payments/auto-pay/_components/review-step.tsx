"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PartialRowsTable } from "./partial-rows-table";
import { formatCurrency } from "@/lib/format";
import type { AutoPayPreview } from "@/types";

interface ReviewStepProps {
  preview: AutoPayPreview;
  includedPartialIds: Set<number>;
  onTogglePartial: (scheduleId: number, included: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
  processing: boolean;
}

export function ReviewStep({
  preview,
  includedPartialIds,
  onTogglePartial,
  onBack,
  onConfirm,
  processing,
}: ReviewStepProps) {
  const derived = useMemo(() => {
    const included = preview.partial_rows.filter((r) =>
      includedPartialIds.has(r.schedule_id)
    );
    const addPrincipal = included.reduce((s, r) => s + r.principal_remaining, 0);
    const addInterest = included.reduce((s, r) => s + r.interest_remaining, 0);
    const partialLoanIds = new Set(included.map((r) => r.loan_id));
    return {
      total_principal: preview.summary.total_principal + addPrincipal,
      total_interest: preview.summary.total_interest + addInterest,
      total_amount: preview.summary.total_amount + addPrincipal + addInterest,
      loans_count: preview.summary.loans_count + partialLoanIds.size,
    };
  }, [preview, includedPartialIds]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950/20">
          <p className="text-xl font-bold text-green-700 dark:text-green-300">
            {formatCurrency(derived.total_principal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total Principal</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-950/20">
          <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
            {formatCurrency(derived.total_interest)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total Interest</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950/20">
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
            {derived.loans_count}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Loans Affected</p>
        </div>
      </div>

      {/* Partial Rows Review */}
      {preview.partial_rows.length > 0 && (
        <PartialRowsTable
          rows={preview.partial_rows}
          includedIds={includedPartialIds}
          onToggle={onTogglePartial}
        />
      )}

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
          disabled={processing || derived.loans_count === 0}
          className="flex-1 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          {processing && <Spinner className="mr-2 size-4" />}
          ✓ Run Auto-Pay
        </Button>
      </div>
    </div>
  );
}
