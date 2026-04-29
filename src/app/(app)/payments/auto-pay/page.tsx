"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { RouteGuard } from "@/components/common";
import { autoPayService } from "@/services/auto-pay.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FiltersStep } from "./_components/filters-step";
import { ReviewStep } from "./_components/review-step";
import type { AutoPayFilter, AutoPayPreview } from "@/types";

export default function AutoPayPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [filter, setFilter] = useState<AutoPayFilter | null>(null);
  const [preview, setPreview] = useState<AutoPayPreview | null>(null);
  const [includedPartialIds, setIncludedPartialIds] = useState<Set<number>>(
    new Set()
  );
  const [previewing, setPreviewing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handlePreview = useCallback(async (f: AutoPayFilter) => {
    setPreviewing(true);
    try {
      const result = await autoPayService.preview(f);
      setFilter(f);
      setPreview(result);
      setIncludedPartialIds(
        new Set(result.partial_rows.map((r) => r.schedule_id))
      );
      setStep(2);
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? (err.response?.data?.message ?? err.message)
          : "Failed to load preview.";
      toast.error(msg);
    } finally {
      setPreviewing(false);
    }
  }, []);

  const handleTogglePartial = useCallback(
    (scheduleId: number, included: boolean) => {
      setIncludedPartialIds((prev) => {
        const next = new Set(prev);
        if (included) next.add(scheduleId);
        else next.delete(scheduleId);
        return next;
      });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!filter || !preview) return;
    setProcessing(true);
    try {
      const result = await autoPayService.process({
        ...filter,
        include_schedule_ids: Array.from(includedPartialIds),
      });
      toast.success(
        `Auto-Pay complete — ${result.processed} loan${result.processed !== 1 ? "s" : ""} processed.`
      );
      setStep(1);
      setFilter(null);
      setPreview(null);
      setIncludedPartialIds(new Set());
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? (err.response?.data?.message ?? err.message)
          : "Auto-Pay failed.";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }, [filter, preview, includedPartialIds]);

  return (
    <RouteGuard permission="auto_pay:view">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auto-Pay</h1>
          <p className="mt-1 text-muted-foreground">
            Batch-process loan dues for all auto-pay-enabled loans.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              step === 1
                ? "font-semibold text-brand-orange"
                : "text-muted-foreground"
            )}
          >
            1. Filters
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className={cn(
              step === 2
                ? "font-semibold text-brand-orange"
                : "text-muted-foreground"
            )}
          >
            2. Review &amp; Confirm
          </span>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              {step === 1 ? "Set Filters" : "Review & Confirm"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <FiltersStep onPreview={handlePreview} loading={previewing} />
            ) : preview ? (
              <ReviewStep
                preview={preview}
                includedPartialIds={includedPartialIds}
                onTogglePartial={handleTogglePartial}
                onBack={() => setStep(1)}
                onConfirm={handleConfirm}
                processing={processing}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
