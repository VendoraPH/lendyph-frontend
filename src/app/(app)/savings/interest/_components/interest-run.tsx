"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { useApiResource, useSubmitGuard } from "@/hooks";
import { BranchFilter } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { notifySuccess, notifyWarning } from "@/lib/notify";
import { savingsInterestService } from "@/services/savings-interest.service";
import type { InterestPreview, InterestPreviewRequest } from "@/types/savings";
import { ConfirmActionDialog } from "../../_components/confirm-action-dialog";
import { ProductFilter } from "../../_components/product-filter";
import { emptyRunForm, interestRequest, type InterestRunForm } from "../../_lib/interest-batch";
import { InterestRows, InterestTotals } from "./interest-rows";

const NO_PREVIEW = () => Promise.resolve(null);

function RunFilters({ form, onChange }: { form: InterestRunForm; onChange: (next: InterestRunForm) => void }) {
  const set = (patch: Partial<InterestRunForm>) => onChange({ ...form, ...patch });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Period</Label>
        <DateRangeFilter
          from={form.periodFrom}
          to={form.periodTo}
          onChange={(periodFrom, periodTo) => set({ periodFrom, periodTo })}
        />
      </div>
      <ProductFilter value={form.productId} onChange={(productId) => set({ productId })} />
      <BranchFilter value={form.branchId} onChange={(branchId) => set({ branchId })} />
    </div>
  );
}

/**
 * Compute interest for a period without saving anything, then save that
 * scope as a draft batch. The server recomputes on save; the preview is only
 * what it showed for the request on screen.
 */
export function InterestRun() {
  const router = useRouter();
  const guard = useSubmitGuard();
  const [form, setForm] = useState(() => emptyRunForm(todayISO()));
  const [request, setRequest] = useState<InterestPreviewRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetcher = useCallback(
    () => (request ? savingsInterestService.preview(request) : NO_PREVIEW()),
    [request],
  );
  const resource = useApiResource<InterestPreview | null>(fetcher, request !== null);

  const runPreview = () => {
    const check = interestRequest(form, todayISO());
    if (!check.ok) {
      notifyWarning(check.message);
      return;
    }
    setRequest(check.request);
  };

  const createBatch = async () => {
    if (!request) return;
    const batch = await guard.run(() => savingsInterestService.createBatch(request));
    if (!batch) return;
    notifySuccess("Interest batch created", batch.reference_number);
    router.push(`/savings/interest/${batch.id}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compute interest</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RunFilters
          form={form}
          onChange={(next) => {
            setForm(next);
            setRequest(null);
          }}
        />
        <Button onClick={runPreview}>
          <Calculator className="mr-2 h-4 w-4" />
          Preview
        </Button>

        {request && (
          <DataState
            resource={resource}
            summary="Interest each savings account would earn for this period, with the inputs behind it."
            endpoints={["POST /savings/interest/preview"]}
          >
            {(preview) =>
              preview && (
                <div className="space-y-4">
                  <InterestTotals totals={preview.totals} />
                  <InterestRows rows={preview.rows} />
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setConfirming(true)}
                      disabled={preview.totals.eligible_accounts === 0}
                      className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                    >
                      Create batch
                    </Button>
                  </div>
                  <ConfirmActionDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    title="Create interest batch?"
                    description={`${formatDate(request.period_from)} to ${formatDate(request.period_to)}: ${formatCurrency(preview.totals.total_interest)} for ${preview.totals.eligible_accounts} account(s). The batch is saved as a draft; nothing is posted yet.`}
                    confirmLabel="Create batch"
                    errorFallback="The interest batch could not be created."
                    onConfirm={createBatch}
                  />
                </div>
              )
            }
          </DataState>
        )}
      </CardContent>
    </Card>
  );
}
