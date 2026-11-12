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
import { getFieldErrors, httpStatusOf } from "@/lib/api-error";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { InterestCrediting, SavingsProduct, SavingsProductKind } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { INTEREST_CREDITING_LABELS, PRODUCT_KIND_LABELS } from "../../_lib/savings-rules";
import { readCreateDraft, readUpdateDraft, toDraft, type ProductDraft } from "../_lib/product-draft";
import { ProductRulesFields } from "./product-rules-fields";

interface ProductDialogProps {
  open: boolean;
  /** The product being edited; null adds one. */
  product: SavingsProduct | null;
  /** Every product, for the pre-termination product picker. */
  products: readonly SavingsProduct[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const CREDITING_OPTIONS = (Object.keys(INTEREST_CREDITING_LABELS) as InterestCrediting[]).map((v) => ({
  value: v,
  label: INTEREST_CREDITING_LABELS[v],
}));

const KIND_OPTIONS = (Object.keys(PRODUCT_KIND_LABELS) as SavingsProductKind[]).map((v) => ({
  value: v,
  label: PRODUCT_KIND_LABELS[v],
}));

export function ProductDialog({ open, product, products, onOpenChange, onSaved }: ProductDialogProps) {
  const [draft, setDraft] = useState<ProductDraft>(() => toDraft(product));
  const [submitting, setSubmitting] = useState(false);
  // The server's 422 field messages, in its words, until the next save.
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  if (useDialogOpening(open, product)) {
    setDraft(toDraft(product));
    setServerErrors([]);
  }

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const td = draft.kind === "time_deposit";
  const regularOptions = products
    .filter((p) => p.kind === "regular")
    .map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }));

  function save() {
    let request: Promise<unknown>;
    if (product) {
      const { input, problems } = readUpdateDraft(draft);
      if (problems.length) return notifyValidation(problems);
      request = savingsService.updateProduct(product.id, input);
    } else {
      const { input, problems } = readCreateDraft(draft);
      if (problems.length) return notifyValidation(problems);
      request = savingsService.createProduct(input);
    }
    setSubmitting(true);
    setServerErrors([]);
    request
      .then(() => {
        notifySuccess(product ? "Product updated" : "Product added", draft.name.trim());
        onOpenChange(false);
        onSaved();
      })
      .catch((err: unknown) => {
        if (httpStatusOf(err) === 422) setServerErrors(getFieldErrors(err));
        notifyError(err, "Couldn't save the product.");
      })
      .then(() => setSubmitting(false));
  }

  const money = (id: string, label: string, key: "minOpening" | "maintaining" | "minAdb") => (
    <FormField id={id} label={label}>
      <Input id={id} inputMode="decimal" value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder="0.00" />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "Add a savings product"}</DialogTitle>
          <DialogDescription>
            {td
              ? "Changes apply to new placements. A running placement keeps the rate it was placed at."
              : "Changes apply from now on. Interest already credited is not recalculated."}{" "}
            {product ? "Rates are added in the product's rates table." : null}
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
            {!product && (
              <FormField
                id="pd-rate"
                label="Interest rate (% per year)"
                hint={td ? "The first rate for every term; set rates by term later." : "The first rate, from today."}
              >
                <Input id="pd-rate" inputMode="decimal" value={draft.rate} onChange={(e) => set("rate", e.target.value)} placeholder={td ? "4.00" : "2.00"} />
              </FormField>
            )}
            {td ? (
              <FormField
                id="pd-pre"
                label="Early termination pays the rate of"
                hint="A regular savings product. Its rate on the placement date is kept for the placement."
              >
                <OptionSelect
                  id="pd-pre"
                  value={draft.preProductId}
                  onChange={(v) => set("preProductId", v)}
                  options={regularOptions}
                  placeholder="Choose a regular product"
                  disabled={regularOptions.length === 0}
                />
              </FormField>
            ) : (
              <FormField id="pd-crediting" label="Interest credited">
                <OptionSelect id="pd-crediting" value={draft.crediting} onChange={(v) => set("crediting", v as InterestCrediting)} options={CREDITING_OPTIONS} />
              </FormField>
            )}
          </div>
          {td ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="pd-terms" label="Terms offered (days)" hint="Comma-separated. The standard terms are 30, 90, 180 and 365.">
                <Input id="pd-terms" value={draft.terms} onChange={(e) => set("terms", e.target.value)} placeholder="30, 90, 180, 365" />
              </FormField>
              {money("pd-min", "Minimum placement", "minOpening")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {money("pd-min", "Minimum to open", "minOpening")}
              {money("pd-maint", "Maintaining balance", "maintaining")}
              {money("pd-earn", "Minimum average daily balance to earn interest", "minAdb")}
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="pd-active">{td ? "Available for new placements" : "Available for new accounts"}</Label>
              <p className="text-xs text-muted-foreground">
                {td ? "Running placements continue either way." : "Existing accounts keep running either way."} It
                can be turned on only once the savings books are set up in Accounting.
              </p>
            </div>
            <Switch id="pd-active" checked={draft.active} onCheckedChange={(v) => set("active", Boolean(v))} />
          </div>
          <ProductRulesFields draft={draft} set={set} open={open} />
          {serverErrors.length > 0 && (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium">The product wasn&apos;t saved:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {serverErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
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
