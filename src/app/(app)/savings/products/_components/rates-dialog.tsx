"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { useApiResource, useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDate, formatRate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsProduct } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { actorName } from "../../_lib/savings-rules";
import { ladderLines, rateTermLabel, readRateDraft, tierLabel, type RateDraft } from "../_lib/rate-draft";
import { TierRateForm } from "./tier-rate-form";

interface RatesDialogProps {
  product: SavingsProduct | null;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

/**
 * A product's rates: on a time deposit one per term, on a regular product a
 * ladder of balance tiers (gap round S2). Shows what is in force today, the
 * full history, and the form to add rates. Rates are append-only: new rates
 * take effect on their date and never rewrite interest already credited.
 */
export function RatesDialog({ product, onOpenChange, onAdded }: RatesDialogProps) {
  const open = product !== null;
  const today = todayISO();
  const [draft, setDraft] = useState<RateDraft>({ termDays: "", rate: "", effectiveFrom: today });
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, product?.id ?? null)) {
    setDraft({ termDays: product?.term_options_days?.[0] ? String(product.term_options_days[0]) : "", rate: "", effectiveFrom: today });
  }

  const fetchHistory = useCallback(() => savingsService.rates(product?.id ?? 0), [product?.id]);
  const history = useApiResource(fetchHistory, open);
  const td = product?.kind === "time_deposit";

  const added = () => {
    history.refetch();
    onAdded();
  };

  function add() {
    if (!product) return;
    const { input, problems } = readRateDraft(draft, product, today);
    if (problems.length) return notifyValidation(problems);
    run(() => savingsService.addRate(product.id, input))
      ?.then(() => {
        notifySuccess("Rate added", `${formatRate(input.annual_rate)}% from ${formatDate(input.effective_from)}`);
        setDraft((d) => ({ ...d, rate: "" }));
        added();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't add the rate."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rates · {product?.name}</DialogTitle>
          <DialogDescription>
            The rate in force on a date is the latest one that took effect on or before it. Rates are never edited or
            deleted; add a new one instead.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="rates-today" className="space-y-2">
          <h3 id="rates-today" className="text-sm font-medium">
            In force today
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {td ? (
                    <>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Annual rate</TableHead>
                    </>
                  ) : (
                    <TableHead colSpan={2}>Balance and annual rate</TableHead>
                  )}
                  <TableHead>Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(product?.current_rates ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No rate is in force yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  product?.current_rates.map((r) =>
                    td ? (
                      <TableRow key={`${r.term_days ?? "all"}-${r.effective_from}`}>
                        <TableCell>{rateTermLabel(r.term_days)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRate(r.annual_rate)}%</TableCell>
                        <TableCell>{formatDate(r.effective_from)}</TableCell>
                      </TableRow>
                    ) : (
                      ladderLines(r.tiers?.length ? r.tiers : [{ min_balance: null, annual_rate: r.annual_rate }]).map((line, i) => (
                        <TableRow key={`${r.effective_from}-${i}`}>
                          <TableCell colSpan={2}>{line}</TableCell>
                          <TableCell>{formatDate(r.effective_from)}</TableCell>
                        </TableRow>
                      ))
                    ),
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="rates-add" className="space-y-2">
          <h3 id="rates-add" className="text-sm font-medium">
            {td ? "Add rate" : "Add rates"}
          </h3>
          {product && !td ? (
            <TierRateForm key={product.id} product={product} today={today} onAdded={added} />
          ) : (
            <div className="grid items-end gap-3 sm:grid-cols-4">
              {td && (
                <FormField id="rt-term" label="Term">
                  <OptionSelect
                    id="rt-term"
                    value={draft.termDays}
                    onChange={(v) => setDraft((d) => ({ ...d, termDays: v }))}
                    options={(product?.term_options_days ?? []).map((t) => ({ value: String(t), label: rateTermLabel(t) }))}
                  />
                </FormField>
              )}
              <FormField id="rt-rate" label="Annual rate (%)">
                <Input
                  id="rt-rate"
                  inputMode="decimal"
                  value={draft.rate}
                  onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
                  placeholder="1.2500"
                />
              </FormField>
              <FormField id="rt-from" label="Effective from">
                <Input
                  id="rt-from"
                  type="date"
                  min={today}
                  value={draft.effectiveFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, effectiveFrom: e.target.value }))}
                />
              </FormField>
              <PermissionButton permission="savings:settings" onClick={add} disabled={submitting}>
                {submitting ? "Adding…" : "Add rate"}
              </PermissionButton>
            </div>
          )}
        </section>

        <section aria-labelledby="rates-history" className="space-y-2">
          <h3 id="rates-history" className="text-sm font-medium">
            History
          </h3>
          <DataState
            resource={history}
            endpoints={["GET /savings/products/{id}/rates"]}
            summary="Every rate this product has had will be listed here."
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No rates yet."
          >
            {(rows) => (
              <div className="max-h-64 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective from</TableHead>
                      <TableHead>{td ? "Term" : "Balance"}</TableHead>
                      <TableHead className="text-right">Annual rate</TableHead>
                      <TableHead>Added by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={r.id ?? `${r.term_days ?? "all"}-${r.effective_from}-${i}`}>
                        <TableCell>{formatDate(r.effective_from)}</TableCell>
                        <TableCell>{td ? rateTermLabel(r.term_days) : tierLabel(r.min_balance)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRate(r.annual_rate)}%</TableCell>
                        <TableCell>{actorName(r.created_by)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DataState>
        </section>
      </DialogContent>
    </Dialog>
  );
}
