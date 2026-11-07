"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { InterestPosting, SavingsProduct, SavingsProductInput } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { INTEREST_POSTING_LABELS, productProblems, toAmount } from "../../_lib/savings-rules";

interface ProductDialogProps {
  open: boolean;
  /** The product being edited; null adds one. */
  product: SavingsProduct | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Text fields hold what is typed; numbers are read on save. */
interface Draft {
  code: string;
  name: string;
  rate: string;
  posting: InterestPosting;
  minOpening: string;
  maintaining: string;
  minForInterest: string;
  dormantDays: string;
  active: boolean;
}

function toDraft(p: SavingsProduct | null): Draft {
  return {
    code: p?.code ?? "",
    name: p?.name ?? "",
    rate: p ? String(toAmount(p.annual_interest_rate)) : "",
    posting: p?.interest_posting ?? "quarterly",
    minOpening: p ? String(toAmount(p.minimum_opening_balance)) : "",
    maintaining: p ? String(toAmount(p.maintaining_balance)) : "",
    minForInterest: p ? String(toAmount(p.minimum_balance_for_interest)) : "",
    dormantDays: p?.dormant_after_days != null ? String(p.dormant_after_days) : "",
    active: p?.is_active ?? true,
  };
}

function toInput(d: Draft): SavingsProductInput {
  const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
  return {
    code: d.code.trim(),
    name: d.name.trim(),
    // Time deposits are Part 2; this screen only manages passbook products.
    kind: "regular",
    annual_interest_rate: num(d.rate),
    interest_posting: d.posting,
    minimum_opening_balance: num(d.minOpening),
    maintaining_balance: num(d.maintaining),
    minimum_balance_for_interest: num(d.minForInterest),
    dormant_after_days: d.dormantDays.trim() === "" ? null : Number(d.dormantDays),
    is_active: d.active,
  };
}

const POSTING_OPTIONS = (Object.keys(INTEREST_POSTING_LABELS) as InterestPosting[]).map((v) => ({
  value: v,
  label: INTEREST_POSTING_LABELS[v],
}));

export function ProductDialog({ open, product, onOpenChange, onSaved }: ProductDialogProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, product)) setDraft(toDraft(product));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function save() {
    const input = toInput(draft);
    const problems = productProblems(input);
    // A typed value that is not a number reads as NaN; name it rather than saving it.
    const numbers: [string, number | null][] = [
      ["Interest rate", input.annual_interest_rate as number],
      ["Minimum opening balance", input.minimum_opening_balance as number],
      ["Maintaining balance", input.maintaining_balance as number],
      ["Minimum balance to earn interest", input.minimum_balance_for_interest as number],
    ];
    for (const [label, n] of numbers) if (Number.isNaN(n) && !problems.includes(label)) problems.push(label);
    if (problems.length) return notifyValidation(problems);

    setSubmitting(true);
    const request = product
      ? savingsService.updateProduct(product.id, input)
      : savingsService.createProduct(input);
    request
      .then(() => {
        notifySuccess(product ? "Product updated" : "Product added", input.name);
        onOpenChange(false);
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't save the product."))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "Add a savings product"}</DialogTitle>
          <DialogDescription>
            Changes apply to new postings. Interest already credited is not recalculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="pd-code" label="Code">
              <Input id="pd-code" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="RS" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="pd-name" label="Name">
                <Input id="pd-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Regular Savings" />
              </FormField>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pd-rate" label="Interest rate (% per year)">
              <Input id="pd-rate" inputMode="decimal" value={draft.rate} onChange={(e) => set("rate", e.target.value)} placeholder="2.00" />
            </FormField>
            <FormField id="pd-posting" label="Interest credited">
              <OptionSelect id="pd-posting" value={draft.posting} onChange={(v) => set("posting", v as InterestPosting)} options={POSTING_OPTIONS} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="pd-min" label="Minimum to open">
              <Input id="pd-min" inputMode="decimal" value={draft.minOpening} onChange={(e) => set("minOpening", e.target.value)} placeholder="0.00" />
            </FormField>
            <FormField id="pd-maint" label="Maintaining balance">
              <Input id="pd-maint" inputMode="decimal" value={draft.maintaining} onChange={(e) => set("maintaining", e.target.value)} placeholder="0.00" />
            </FormField>
            <FormField id="pd-earn" label="Minimum to earn interest">
              <Input id="pd-earn" inputMode="decimal" value={draft.minForInterest} onChange={(e) => set("minForInterest", e.target.value)} placeholder="0.00" />
            </FormField>
          </div>
          <FormField id="pd-dormant" label="Dormant after (days)" hint="Days without a member transaction. Leave blank to never mark dormant.">
            <Input id="pd-dormant" inputMode="numeric" value={draft.dormantDays} onChange={(e) => set("dormantDays", e.target.value)} placeholder="730" />
          </FormField>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="pd-active">Available for new accounts</Label>
              <p className="text-xs text-muted-foreground">Existing accounts keep running either way.</p>
            </div>
            <Switch id="pd-active" checked={draft.active} onCheckedChange={(v) => set("active", Boolean(v))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={submitting}>
            {submitting ? "Saving…" : "Save product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
