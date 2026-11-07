"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB, type ApplicationDraft } from "@/lib/portal/requests";
import type { PortalLoanProduct } from "@/types/portal";

export interface StepProps {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
  product: PortalLoanProduct;
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AmountInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return <Input id={id} inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function LoanStep({ draft, set, product }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="app-amount"
        label="Amount"
        hint={`${formatCurrency(product.min_amount)} to ${formatCurrency(product.max_amount)}`}
      >
        <AmountInput id="app-amount" value={draft.amount} onChange={(amount) => set({ amount })} />
      </Field>
      <Field id="app-term" label={`Term (${product.term_unit})`} hint={`${product.min_term} to ${product.max_term}`}>
        <Input
          id="app-term"
          type="number"
          inputMode="numeric"
          min={product.min_term}
          max={product.max_term}
          value={draft.term}
          onChange={(e) => set({ term: e.target.value })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field id="app-purpose" label="What the loan is for">
          <Textarea id="app-purpose" rows={2} value={draft.purpose} onChange={(e) => set({ purpose: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

export function IncomeStep({ draft, set }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="app-income" label="Monthly income">
        <AmountInput id="app-income" value={draft.monthly_income} onChange={(monthly_income) => set({ monthly_income })} />
      </Field>
      <Field id="app-source" label="Source of income (optional)">
        <Input id="app-source" value={draft.income_source} onChange={(e) => set({ income_source: e.target.value })} />
      </Field>
      <Field id="app-other" label="Other monthly income (optional)">
        <AmountInput id="app-other" value={draft.other_income} onChange={(other_income) => set({ other_income })} />
      </Field>
      <Field id="app-expenses" label="Monthly expenses (optional)">
        <AmountInput id="app-expenses" value={draft.monthly_expenses} onChange={(monthly_expenses) => set({ monthly_expenses })} />
      </Field>
    </div>
  );
}

export function CollateralStep({ draft, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Field id="app-collateral" label="Collateral you are offering" hint="For example: a 2019 motorcycle, OR/CR in your name.">
        <Textarea
          id="app-collateral"
          rows={3}
          value={draft.collateral_description}
          onChange={(e) => set({ collateral_description: e.target.value })}
        />
      </Field>
      <Field id="app-collateral-value" label="Estimated value (optional)">
        <AmountInput
          id="app-collateral-value"
          value={draft.collateral_value}
          onChange={(collateral_value) => set({ collateral_value })}
        />
      </Field>
    </div>
  );
}

export function DocumentsStep({ draft, set, product }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">PDF or photo, up to {MAX_ATTACHMENT_MB} MB each.</p>
      {product.required_documents.map((name, i) => (
        <Field key={name} id={`app-doc-${i}`} label={name}>
          <Input
            id={`app-doc-${i}`}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            onChange={(e) => set({ documents: { ...draft.documents, [name]: e.target.files?.[0] } })}
          />
          {draft.documents[name] && <p className="text-xs text-muted-foreground">{draft.documents[name]?.name}</p>}
        </Field>
      ))}
    </div>
  );
}
