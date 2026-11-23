"use client";

import { Loader2 } from "lucide-react";
import { pesoOrDash } from "@/lib/credit-scoring/capacity";
import { formatCurrency } from "@/lib/format";
import { RELEASE_METHODS } from "@/lib/loan-origination";
import type { PublicEstimate, PublicProduct } from "@/types/public-application";
import { amountRange, scheduleWords, termChoices, termRange } from "../_lib/portal-state";
import { MoneyField, SelectField, TextAreaField, TextField } from "./form-field";
import type { StepProps } from "./step-types";

export interface EstimateState {
  estimate: PublicEstimate | null;
  error: string | null;
  loading: boolean;
}

/** The server's estimate, every figure as it sent it: the loan form's own preview. */
function EstimateBox({ estimate, error, loading }: EstimateState) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Working out your estimate…
      </p>
    );
  }
  if (error) return <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{error}</p>;
  if (!estimate) return null;
  return (
    <div className="space-y-3 rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-4" aria-live="polite">
      <p className="text-sm text-muted-foreground">Estimated payment</p>
      <p className="text-2xl font-semibold tabular-nums">
        {formatCurrency(estimate.installment)}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {scheduleWords(estimate.frequency).toLowerCase()}, {estimate.installments_count} payments
        </span>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Interest</dt>
        <dd className="text-right tabular-nums">{formatCurrency(estimate.total_interest)}</dd>
        <dt className="text-muted-foreground">Principal and interest to repay</dt>
        <dd className="text-right tabular-nums">{formatCurrency(estimate.total_repayment)}</dd>
        {estimate.charges.map((c, i) => (
          <div key={`${i}-${c.name}`} className="contents">
            <dt className="text-muted-foreground">{c.name}</dt>
            <dd className="text-right tabular-nums">{formatCurrency(c.amount)}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Charges taken from the loan</dt>
        <dd className="text-right tabular-nums">{formatCurrency(estimate.total_charges)}</dd>
        <dt className="font-medium">You receive</dt>
        <dd className="text-right font-medium tabular-nums">{pesoOrDash(estimate.net_proceeds)}</dd>
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {estimate.assumptions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function StepLoan({
  value: l,
  errors,
  onChange,
  product,
  estimate,
}: StepProps<"loan"> & {
  product: PublicProduct | undefined;
  estimate: EstimateState;
}) {
  if (!product) return <p className="text-sm text-destructive">{errors.loan_product_id ?? "Choose a loan product first."}</p>;
  const terms = termChoices(product);
  const termLabel = `Repayment term (${product.term_unit})`;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="amount"
          label="Amount to borrow"
          required
          hint={amountRange(product) ?? undefined}
          value={l.amount}
          error={errors.amount}
          onChange={(amount) => onChange({ amount })}
        />
        {terms ? (
          <SelectField
            id="term"
            label={termLabel}
            required
            options={terms.map((t) => ({ value: String(t), label: `${t} ${product.term_unit}` }))}
            value={l.term}
            error={errors.term}
            onChange={(term) => onChange({ term })}
          />
        ) : (
          <TextField
            id="term"
            label={termLabel}
            required
            inputMode="numeric"
            hint={termRange(product) ?? undefined}
            value={l.term}
            error={errors.term}
            onChange={(term) => onChange({ term })}
          />
        )}
        {product.payment_frequencies.length > 1 && (
          <SelectField
            id="frequency"
            label="Pay"
            required
            options={product.payment_frequencies.map((f) => ({ value: f, label: scheduleWords(f) }))}
            value={l.frequency}
            error={errors.frequency}
            onChange={(frequency) => onChange({ frequency })}
          />
        )}
        <SelectField id="release_method" label="Receive the money by" options={RELEASE_METHODS} value={l.release_method} error={errors.release_method} onChange={(release_method) => onChange({ release_method })} />
        <TextAreaField id="purpose" label="What the loan is for" required className="sm:col-span-2" value={l.purpose} error={errors.purpose} onChange={(purpose) => onChange({ purpose })} />
      </div>
      <EstimateBox {...estimate} />
      {product.instructions && <p className="whitespace-pre-line text-sm text-muted-foreground">{product.instructions}</p>}
    </div>
  );
}
