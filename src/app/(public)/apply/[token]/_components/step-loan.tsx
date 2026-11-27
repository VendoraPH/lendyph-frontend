"use client";

import { Loader2 } from "lucide-react";
import { pesoOrDash } from "@/lib/credit-scoring/capacity";
import { formatCurrency, formatDate } from "@/lib/format";
import { RELEASE_METHODS } from "@/lib/loan-origination";
import type { PublicEstimate, PublicProduct } from "@/types/public-application";
import { estimateHeadline } from "../_lib/estimate";
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
      <p className="text-xl font-semibold tabular-nums">{estimateHeadline(estimate)}</p>
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
      {estimate.schedule.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">See each payment</summary>
          <table className="mt-2 w-full text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">#</th>
                <th className="py-1 font-medium">Due</th>
                <th className="py-1 text-right font-medium">Principal</th>
                <th className="py-1 text-right font-medium">Interest</th>
                <th className="py-1 text-right font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {estimate.schedule.map((row) => (
                <tr key={row.number} className="border-t border-brand-orange/10">
                  <td className="py-1">{row.number}</td>
                  <td className="py-1">{formatDate(row.due_date)}</td>
                  <td className="py-1 text-right">{formatCurrency(row.principal)}</td>
                  <td className="py-1 text-right">{formatCurrency(row.interest)}</td>
                  <td className="py-1 text-right">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
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
