"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormStep, FormStepper, type FormStepperHandle } from "@/components/common/form-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDialogOpening } from "@/hooks";
import { getFieldErrors, httpStatusOf } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { FORM_STEP_GRID } from "@/lib/form-stepper";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { InterestCrediting, SavingsProduct, SavingsProductKind } from "@/types";
import { ALIGNED_FIELDS, FormField } from "@/app/(app)/savings/_components/field";
import { OptionSelect } from "@/app/(app)/savings/_components/option-select";
import { INTEREST_CREDITING_LABELS, PRODUCT_KIND_LABELS } from "@/app/(app)/savings/_lib/savings-rules";
import { errorsForStep, serverStepErrors } from "@/app/(app)/savings/_lib/step-errors";
import { readCreateDraft, readUpdateDraft, toDraft, type ProductDraft } from "../_lib/product-draft";
import { productProblemErrors, productSteps } from "../_lib/product-steps";
import { ProductAllowedFields, ProductEligibilityFields, ProductLimitsFields } from "./product-rules-fields";

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
  const stepperRef = useRef<FormStepperHandle>(null);
  if (useDialogOpening(open, product)) {
    setDraft(toDraft(product));
    setServerErrors([]);
  }

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const td = draft.kind === "time_deposit";
  const steps = productSteps(draft.kind);
  // The same checks Save makes, by field, so Next names the open step's problems.
  const problemErrors = productProblemErrors((product ? readUpdateDraft(draft) : readCreateDraft(draft)).problems);
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
        if (httpStatusOf(err) === 422) {
          setServerErrors(getFieldErrors(err));
          stepperRef.current?.showErrors(serverStepErrors(err));
        }
        notifyError(err, "Couldn't save the product.");
      })
      .then(() => setSubmitting(false));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  const money = (id: string, field: string, label: string, key: "minOpening" | "maintaining" | "minAdb") => (
    <FormField id={id} field={field} label={label}>
      <Input id={id} inputMode="decimal" value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder="0.00" />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "Add a savings product"}</DialogTitle>
          <DialogDescription>
            {td
              ? "Changes apply to new placements. A running placement keeps the rate it was placed at."
              : "Changes apply from now on. Interest already credited is not recalculated."}{" "}
            {product ? "Rates are added in the product's rates table." : null}
          </DialogDescription>
        </DialogHeader>

        {serverErrors.length > 0 && (
          <div
            role="alert"
            className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <p className="font-medium">The product wasn&apos;t saved:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {serverErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormStepper
            ref={stepperRef}
            layout="dialog"
            mode={product ? "edit" : "create"}
            steps={steps}
            validateStep={(id) => errorsForStep(problemErrors, steps, id)}
            submitLabel="Save product"
            submittingLabel="Saving…"
            submitting={submitting}
            actions={
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
            }
          >
            <FormStep id="details" className="space-y-4">
              <div className={cn(FORM_STEP_GRID.roomy, ALIGNED_FIELDS)}>
                <FormField
                  id="pd-kind"
                  field="kind"
                  label="Kind"
                  hint={product ? "The kind can't change once a product exists." : undefined}
                >
                  <OptionSelect
                    id="pd-kind"
                    value={draft.kind}
                    onChange={(v) => set("kind", v as SavingsProductKind)}
                    options={KIND_OPTIONS}
                    disabled={product !== null}
                  />
                </FormField>
                <FormField id="pd-code" field="code" label="Code">
                  <Input
                    id="pd-code"
                    value={draft.code}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder={td ? "TD90" : "RS"}
                  />
                </FormField>
                <FormField id="pd-name" field="name" label="Name">
                  <Input
                    id="pd-name"
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder={td ? "Time Deposit 90 days" : "Regular Savings"}
                  />
                </FormField>
              </div>
              <div data-field="is_active" className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="pd-active">{td ? "Available for new placements" : "Available for new accounts"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {td ? "Running placements continue either way." : "Existing accounts keep running either way."} It
                    can be turned on only once the savings books are set up in Accounting.
                  </p>
                </div>
                <Switch id="pd-active" checked={draft.active} onCheckedChange={(v) => set("active", Boolean(v))} />
              </div>
              {!td && (
                <div
                  data-field="portal_account_requests"
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <Label htmlFor="pd-portal">Accept new-account requests from the member portal</Label>
                    <p className="text-xs text-muted-foreground">
                      Members can ask to open this product from the portal; staff still approve each request.
                    </p>
                  </div>
                  <Switch
                    id="pd-portal"
                    checked={draft.portalRequests}
                    onCheckedChange={(v) => set("portalRequests", Boolean(v))}
                  />
                </div>
              )}
              {!td && (
                <div
                  data-field="portal_withdrawal_requests"
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <Label htmlFor="pd-portal-withdrawals">Accept withdrawal requests from the member portal</Label>
                    <p className="text-xs text-muted-foreground">
                      Members can ask to withdraw from these accounts in the portal; staff still approve and pay out each request.
                    </p>
                  </div>
                  <Switch
                    id="pd-portal-withdrawals"
                    checked={draft.portalWithdrawals}
                    onCheckedChange={(v) => set("portalWithdrawals", Boolean(v))}
                  />
                </div>
              )}
            </FormStep>

            <FormStep id="interest">
              <div className={cn(FORM_STEP_GRID.roomy, ALIGNED_FIELDS)}>
                {!product && (
                  <FormField
                    id="pd-rate"
                    field="annual_interest_rate"
                    label="Interest rate (% per year)"
                    hint={td ? "The first rate for every term; set rates by term later." : "The first rate, from today."}
                  >
                    <Input
                      id="pd-rate"
                      inputMode="decimal"
                      value={draft.rate}
                      onChange={(e) => set("rate", e.target.value)}
                      placeholder={td ? "4.00" : "2.00"}
                    />
                  </FormField>
                )}
                {td ? (
                  <FormField
                    id="pd-pre"
                    field="pretermination_product_id"
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
                  <FormField id="pd-crediting" field="interest_crediting" label="Interest credited">
                    <OptionSelect
                      id="pd-crediting"
                      value={draft.crediting}
                      onChange={(v) => set("crediting", v as InterestCrediting)}
                      options={CREDITING_OPTIONS}
                    />
                  </FormField>
                )}
                {td ? (
                  <>
                    <FormField
                      id="pd-terms"
                      field="term_options_days"
                      label="Terms offered (days)"
                      hint="Comma-separated. The standard terms are 30, 90, 180 and 365."
                    >
                      <Input
                        id="pd-terms"
                        value={draft.terms}
                        onChange={(e) => set("terms", e.target.value)}
                        placeholder="30, 90, 180, 365"
                      />
                    </FormField>
                    {money("pd-min", "minimum_opening_balance", "Minimum placement", "minOpening")}
                  </>
                ) : (
                  <>
                    {money("pd-min", "minimum_opening_balance", "Minimum to open", "minOpening")}
                    {money("pd-maint", "maintaining_balance", "Maintaining balance", "maintaining")}
                    {money(
                      "pd-earn",
                      "minimum_adb_for_interest",
                      "Minimum average daily balance to earn interest",
                      "minAdb",
                    )}
                  </>
                )}
              </div>
            </FormStep>

            {!td && (
              <FormStep id="limits">
                <ProductLimitsFields draft={draft} set={set} />
              </FormStep>
            )}
            {!td && (
              <FormStep id="allowed">
                <ProductAllowedFields draft={draft} set={set} />
              </FormStep>
            )}
            <FormStep id="eligibility">
              <ProductEligibilityFields draft={draft} set={set} open={open} />
            </FormStep>
          </FormStepper>
        </form>
      </DialogContent>
    </Dialog>
  );
}
