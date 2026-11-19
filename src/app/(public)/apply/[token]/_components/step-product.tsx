"use client";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicLoanProduct } from "@/types/loan-origination";

/** Choosing the product first lets later steps show its limits. */
export function StepProduct({
  products,
  value,
  error,
  onChange,
}: {
  products: PublicLoanProduct[];
  value: number | null;
  error?: string;
  onChange: (id: number) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Loan product</legend>
      {products.map((p) => (
        <label
          key={p.id}
          className={cn(
            "flex cursor-pointer gap-3 rounded-xl border bg-card p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-orange/40",
            value === p.id ? "border-brand-orange bg-brand-orange/5" : "hover:border-foreground/30",
          )}
        >
          <input
            type="radio"
            name="loan-product"
            className="mt-1"
            checked={value === p.id}
            onChange={() => onChange(p.id)}
          />
          <span className="space-y-1">
            <span className="block font-medium">{p.name}</span>
            {p.description && <span className="block text-sm text-muted-foreground">{p.description}</span>}
            <span className="block text-sm">
              {formatCurrency(p.min_amount)} to {formatCurrency(p.max_amount)} · {p.min_term} to {p.max_term} {p.term_unit} ·{" "}
              {p.interest_rate}% {p.interest_rate_frequency.replace(/_/g, " ")}
            </span>
            {p.eligibility && <span className="block text-xs text-muted-foreground">Who may apply: {p.eligibility}</span>}
          </span>
        </label>
      ))}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
