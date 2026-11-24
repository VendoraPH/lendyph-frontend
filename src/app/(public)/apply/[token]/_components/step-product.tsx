"use client";

import { rateWithPeriod } from "@/lib/loan-terms";
import { cn } from "@/lib/utils";
import type { PublicProduct } from "@/types/public-application";
import { amountRange, termRange } from "../_lib/portal-state";

/** A product's limits and rate in one line, from the server's own figures. */
export function ProductFacts({ product }: { product: PublicProduct }) {
  const facts = [amountRange(product), termRange(product), rateWithPeriod(product.interest_rate, product.interest_rate_frequency)];
  return <span className="block text-sm">{facts.filter(Boolean).join(" · ")}</span>;
}

/** Choosing the product first lets later steps show its limits. */
export function StepProduct({
  products,
  value,
  error,
  onChange,
}: {
  products: PublicProduct[];
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
          <input type="radio" name="loan-product" className="mt-1" checked={value === p.id} onChange={() => onChange(p.id)} />
          <span className="space-y-1">
            <span className="block font-medium">{p.name}</span>
            {p.description && <span className="block text-sm text-muted-foreground">{p.description}</span>}
            <ProductFacts product={p} />
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
