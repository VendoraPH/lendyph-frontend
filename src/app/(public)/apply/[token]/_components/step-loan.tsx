"use client";

import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { RELEASE_METHODS } from "@/lib/loan-origination";
import type { LoanEstimate, PublicLoanProduct } from "@/types/loan-origination";
import { MoneyField, SelectField, TextAreaField } from "./form-field";
import type { StepProps } from "./step-types";

const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function EstimateBox({ estimate, error, loading }: { estimate: LoanEstimate | null; error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Working out your estimate…
      </p>
    );
  }
  if (error) return <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{error}</p>;
  if (!estimate) return null;
  const rows: [string, number][] = [
    ["Total interest", estimate.total_interest],
    ...estimate.charges.map((c) => [c.name, c.amount] as [string, number]),
    ["Total to repay", estimate.total_repayment],
    ["You receive", estimate.net_proceeds],
  ];
  return (
    <div className="space-y-3 rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-4" aria-live="polite">
      <p className="text-sm text-muted-foreground">Estimated payment</p>
      <p className="text-2xl font-semibold tabular-nums">
        {formatCurrency(estimate.installment)}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {label(estimate.frequency).toLowerCase()}, {estimate.installments_count} payments
        </span>
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right tabular-nums">{formatCurrency(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        An estimate only, not an offer. {estimate.assumptions.join(" ")} The final figures are set when your loan is approved.
      </p>
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
  product: PublicLoanProduct | undefined;
  estimate: { estimate: LoanEstimate | null; error: string | null; loading: boolean };
}) {
  if (!product) return <p className="text-sm text-destructive">Choose a loan product first.</p>;
  const terms = Array.from({ length: product.max_term - product.min_term + 1 }, (_, i) => product.min_term + i);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="amount"
          label="Amount to borrow"
          required
          hint={`${formatCurrency(product.min_amount)} to ${formatCurrency(product.max_amount)}`}
          value={l.amount}
          error={errors.amount}
          onChange={(amount) => onChange({ amount })}
        />
        <SelectField
          id="term"
          label={`Repayment term (${product.term_unit})`}
          required
          options={terms.map((t) => ({ value: String(t), label: `${t} ${product.term_unit}` }))}
          value={l.term}
          error={errors.term}
          onChange={(term) => onChange({ term })}
        />
        {product.payment_frequencies.length > 1 && (
          <SelectField
            id="frequency"
            label="Pay"
            required
            options={product.payment_frequencies.map((f) => ({ value: f, label: label(f) }))}
            value={l.frequency}
            error={errors.frequency}
            onChange={(frequency) => onChange({ frequency })}
          />
        )}
        <SelectField id="release_method" label="Receive the money by" options={RELEASE_METHODS} value={l.release_method} onChange={(release_method) => onChange({ release_method })} />
        <TextAreaField id="purpose" label="What the loan is for" required className="sm:col-span-2" value={l.purpose} error={errors.purpose} onChange={(purpose) => onChange({ purpose })} />
      </div>
      <EstimateBox {...estimate} />
      {product.instructions && <p className="text-sm text-muted-foreground">{product.instructions}</p>}
    </div>
  );
}
