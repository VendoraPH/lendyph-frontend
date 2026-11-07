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
import type { InterestPosting, SavingsProduct, SavingsProductKind } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { INTEREST_POSTING_LABELS } from "../../_lib/savings-rules";
import { readDraft, toDraft, type ProductDraft } from "../_lib/product-draft";

interface ProductDialogProps {
  open: boolean;
  /** The product being edited; null adds one. */
  product: SavingsProduct | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const POSTING_OPTIONS = (Object.keys(INTEREST_POSTING_LABELS) as InterestPosting[]).map((v) => ({
  value: v,
  label: INTEREST_POSTING_LABELS[v],
}));

const KIND_OPTIONS = [
  { value: "regular", label: "Regular savings (passbook)" },
  { value: "time_deposit", label: "Time deposit" },
];

export function ProductDialog({ open, product, onOpenChange, onSaved }: ProductDialogProps) {
  const [draft, setDraft] = useState<ProductDraft>(() => toDraft(product));
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, product)) setDraft(toDraft(product));

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const td = draft.kind === "time_deposit";

  function save() {
    const { input, problems } = readDraft(draft);
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

  const money = (id: string, label: string, key: "minOpening" | "maintaining" | "minForInterest") => (
    <FormField id={id} label={label}>
      <Input id={id} inputMode="decimal" value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder="0.00" />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "Add a savings product"}</DialogTitle>
          <DialogDescription>
            {td
              ? "Changes apply to new placements. A running placement keeps the rate it was placed at."
              : "Changes apply to new postings. Interest already credited is not recalculated."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="pd-kind" label="Kind" hint={product ? "The kind can't change once a product exists." : undefined}>
            <OptionSelect
              id="pd-kind"
              value={draft.kind}
              onChange={(v) => set("kind", v as SavingsProductKind)}
              options={KIND_OPTIONS}
              disabled={product !== null}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="pd-code" label="Code">
              <Input id="pd-code" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder={td ? "TD90" : "RS"} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="pd-name" label="Name">
                <Input id="pd-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder={td ? "Time Deposit 90 days" : "Regular Savings"} />
              </FormField>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pd-rate" label="Interest rate (% per year)">
              <Input id="pd-rate" inputMode="decimal" value={draft.rate} onChange={(e) => set("rate", e.target.value)} placeholder={td ? "4.00" : "2.00"} />
            </FormField>
            {td ? (
              <FormField id="pd-pre" label="Pre-termination rate (% per year)" hint="Paid instead if a placement is broken early.">
                <Input id="pd-pre" inputMode="decimal" value={draft.preRate} onChange={(e) => set("preRate", e.target.value)} placeholder="1.00" />
              </FormField>
            ) : (
              <FormField id="pd-posting" label="Interest credited">
                <OptionSelect id="pd-posting" value={draft.posting} onChange={(v) => set("posting", v as InterestPosting)} options={POSTING_OPTIONS} />
              </FormField>
            )}
          </div>
          {td ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="pd-terms" label="Terms offered (days)" hint="Comma-separated, e.g. 30, 90, 180, 360.">
                <Input id="pd-terms" value={draft.terms} onChange={(e) => set("terms", e.target.value)} placeholder="90, 180, 360" />
              </FormField>
              {money("pd-min", "Minimum placement", "minOpening")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {money("pd-min", "Minimum to open", "minOpening")}
              {money("pd-maint", "Maintaining balance", "maintaining")}
              {money("pd-earn", "Minimum to earn interest", "minForInterest")}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pd-tax" label="Withholding tax on interest (%)" hint="0 where the cooperative's members are exempt.">
              <Input id="pd-tax" inputMode="decimal" value={draft.withholding} onChange={(e) => set("withholding", e.target.value)} placeholder="20" />
            </FormField>
            {!td && (
              <FormField id="pd-dormant" label="Dormant after (days)" hint="Blank: never mark dormant.">
                <Input id="pd-dormant" inputMode="numeric" value={draft.dormantDays} onChange={(e) => set("dormantDays", e.target.value)} placeholder="730" />
              </FormField>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="pd-active">{td ? "Available for new placements" : "Available for new accounts"}</Label>
              <p className="text-xs text-muted-foreground">
                {td ? "Running placements continue either way." : "Existing accounts keep running either way."}
              </p>
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
