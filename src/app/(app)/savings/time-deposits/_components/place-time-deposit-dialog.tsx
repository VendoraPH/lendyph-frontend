"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormStep, FormStepper, type FormStepperHandle } from "@/components/common/form-stepper";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { env } from "@/config/env";
import { useApiResource, useDialogOpening, usePermission } from "@/hooks";
import { useCashReferencePreview } from "@/hooks/use-cash-reference-preview";
import type { MemberOption } from "@/hooks/use-member-search";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { CASH_REFERENCE_PLACEHOLDER, TIME_DEPOSIT_CASH_SERIES, seriesAutoReference } from "@/lib/cash-reference";
import { cn } from "@/lib/utils";
import { FORM_STEP_GRID } from "@/lib/form-stepper";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService, timeDepositService } from "@/services";
import type { MaturityInstruction, SavingsMethod, TimeDeposit } from "@/types";
import { ALIGNED_FIELDS, FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { ProductChoiceNotice } from "../../_components/product-choice-notice";
import { useBooksReady } from "../../_hooks/use-books-ready";
import { productChoice, productPlaceholder, termChoice } from "@/lib/savings/product-choice";
import { METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "../../_lib/savings-rules";
import { MATURITY_INSTRUCTION_OPTIONS, termsOfferedText } from "../../_lib/time-deposit-rules";
import { errorsForStep, serverStepErrors } from "../../_lib/step-errors";
import { checkPlacement, type PlacementForm } from "../_lib/placement-form";
import { PLACEMENT_STEPS, placementErrors } from "../_lib/placement-steps";
import { PlacementPreview } from "./placement-preview";

interface PlaceTimeDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlaced: (td: TimeDeposit) => void;
}

type Form = Omit<PlacementForm, "memberId"> & { member: MemberOption | null };

const EMPTY: Form = {
  member: null,
  productId: "",
  term: "",
  placementDate: "",
  amount: "",
  instruction: "payout",
  method: "cash",
  fundingAccountId: "",
  payoutAccountId: "",
  reference: "",
};

const FUNDING_OPTIONS = [
  ...PAYMENT_METHOD_OPTIONS,
  { value: "savings" as const, label: `From a ${METHOD_LABELS.savings.toLowerCase()}` },
];

export function PlaceTimeDepositDialog({ open, onOpenChange, onPlaced }: PlaceTimeDepositDialogProps) {
  const { can } = usePermission();
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  // Steps whose errors show: one that failed Next shows its own, before any save.
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<string>>(new Set());
  const stepperRef = useRef<FormStepperHandle>(null);
  const { submitting, run } = useSubmitGuard();
  // Cash placements are numbered by the server (TD-…): while Cash is chosen
  // the Reference field shows its next number, read-only, and moves on after
  // each placement.
  const [placedCount, setPlacedCount] = useState(0);
  const serverNumbersCash = env.features.timeDepositCashReference;
  const cashPreview = useCashReferencePreview(
    timeDepositService.nextCashReference,
    open && serverNumbersCash && form.method === "cash",
    placedCount,
  );
  const autoReference = seriesAutoReference(TIME_DEPOSIT_CASH_SERIES, serverNumbersCash, form.method, cashPreview);
  if (useDialogOpening(open, null)) {
    setForm({ ...EMPTY, placementDate: todayISO() });
    setSubmitted(false);
    setCheckedSteps(new Set());
  }

  const fetchProducts = useCallback(() => savingsService.products(), []);
  const products = useApiResource(fetchProducts, open);
  const noneActive =
    products.data !== null && !products.data.some((p) => p.is_active && p.kind === "time_deposit");
  const books = useBooksReady(open && noneActive);
  const choice = productChoice({
    products: products.data,
    kind: "time_deposit",
    booksReady: books.ready,
    canManage: books.canManage,
  });
  const product = choice.options.some((o) => o.value === form.productId && !o.disabled)
    ? ((products.data ?? []).find((p) => String(p.id) === form.productId) ?? null)
    : null;
  const terms = product?.term_options_days ?? [];
  const term = termChoice(product);
  const choosing = products.loading || books.loading;

  const memberId = form.member?.id ?? null;
  const fetchAccounts = useCallback(
    () => savingsService.accounts({ borrower_id: memberId ?? 0, status: "active", per_page: 100 }),
    [memberId],
  );
  const accounts = useApiResource(fetchAccounts, open && memberId !== null);
  const accountOptions = (accounts.data?.data ?? [])
    .filter((a) => a.product.kind === "regular")
    .map((a) => ({
      value: String(a.id),
      label: `${a.account_number} · available ${formatCurrency(a.available_balance)}`,
    }));

  const { errors, quote, body } = checkPlacement({ ...form, memberId }, product, { serverNumbersCash });
  const keyedErrors = placementErrors(errors);
  const show = (stepId: string, error: string | null) => (submitted || checkedSteps.has(stepId) ? error : null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setSubmitted(true);
    if (!body) return;
    run((key) => timeDepositService.place(body, key))
      ?.then((td) => {
        setPlacedCount((n) => n + 1);
        notifySuccess("Time deposit placed", [td.certificate_number, td.reference].filter(Boolean).join(" · "));
        onOpenChange(false);
        onPlaced(td);
      })
      .catch((err: unknown) => {
        stepperRef.current?.showErrors(serverStepErrors(err));
        notifyError(err, "Couldn't place the time deposit.");
      });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Place a time deposit</DialogTitle>
          <DialogDescription>The rate is fixed for the term. The certificate can be printed once it is placed.</DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormStepper
            ref={stepperRef}
            layout="dialog"
            steps={PLACEMENT_STEPS}
            validateStep={(id) => errorsForStep(keyedErrors, PLACEMENT_STEPS, id)}
            onInvalid={(_, id) => setCheckedSteps((steps) => new Set(steps).add(id))}
            submitLabel="Place time deposit"
            submittingLabel="Placing…"
            submitting={submitting}
            actions={
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
            }
          >
            <FormStep id="member" className="space-y-4">
              <FormField id="td-member" field="borrower_id" label="Member" error={show("member", errors.member)}>
                <MemberSearchPicker
                  id="td-member"
                  value={form.member}
                  onChange={(m) => setForm((f) => ({ ...f, member: m, fundingAccountId: "", payoutAccountId: "" }))}
                  canSearch={can("borrowers:view")}
                  placeholder="Search members"
                  showCode
                />
              </FormField>

              <div className={cn(FORM_STEP_GRID.roomy, ALIGNED_FIELDS)}>
                <FormField
                  id="td-product"
                  field="product_id"
                  label="Product"
                  error={show("member", errors.product)}
                  hint={
                    products.unavailable
                      ? "Savings products aren't available yet."
                      : products.error
                        ? "Couldn't load the savings products. Close this and try again."
                        : product
                          ? `At least ${formatCurrency(product.minimum_opening_balance)}. The rate depends on the term.`
                          : undefined
                  }
                >
                  <OptionSelect
                    id="td-product"
                    value={form.productId}
                    onChange={(v) => setForm((f) => ({ ...f, productId: v, term: "" }))}
                    options={choice.options}
                    placeholder={productPlaceholder({ choosing, selectable: choice.selectable })}
                    disabled={choosing || choice.options.length === 0}
                  />
                </FormField>
                <FormField
                  id="td-term"
                  field="term_days"
                  label="Term"
                  error={show("member", errors.term)}
                  hint={termsOfferedText(terms)}
                >
                  <OptionSelect
                    id="td-term"
                    value={form.term}
                    onChange={(v) => set("term", v)}
                    options={term.options}
                    placeholder={term.placeholder}
                    disabled={term.options.length === 0}
                  />
                </FormField>
              </div>
              {!choosing && choice.empty && <ProductChoiceNotice empty={choice.empty} />}
            </FormStep>

            <FormStep id="payment">
              <div className={cn(FORM_STEP_GRID.roomy, ALIGNED_FIELDS)}>
                <FormField id="td-amount" field="principal" label="Amount placed" error={show("payment", errors.amount)}>
                  <Input
                    id="td-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </FormField>
                <FormField
                  id="td-date"
                  field="placement_date"
                  label="Placement date"
                  error={show("payment", errors.date)}
                >
                  <Input
                    id="td-date"
                    type="date"
                    value={form.placementDate}
                    max={todayISO()}
                    onChange={(e) => set("placementDate", e.target.value)}
                  />
                </FormField>
                <FormField id="td-instruction" field="maturity_instruction" label="At maturity">
                  <OptionSelect
                    id="td-instruction"
                    value={form.instruction}
                    onChange={(v) => set("instruction", v as MaturityInstruction)}
                    options={MATURITY_INSTRUCTION_OPTIONS}
                  />
                </FormField>
                <FormField id="td-method" field="payment_method" label="Paid by">
                  <OptionSelect
                    id="td-method"
                    value={form.method}
                    onChange={(v) => {
                      set("method", v as SavingsMethod);
                      // A number typed for one method never carries over to another.
                      if (serverNumbersCash) set("reference", "");
                    }}
                    options={FUNDING_OPTIONS}
                  />
                </FormField>
                {form.method === "savings" ? (
                  <FormField
                    id="td-funding"
                    field="funding_account_id"
                    label="From account"
                    error={show("payment", errors.funding)}
                  >
                    <OptionSelect
                      id="td-funding"
                      value={form.fundingAccountId}
                      onChange={(v) => set("fundingAccountId", v)}
                      options={accountOptions}
                      placeholder={form.member ? "Choose an account" : "Choose the member first"}
                      disabled={accountOptions.length === 0}
                    />
                  </FormField>
                ) : (
                  <FormField
                    id="td-ref"
                    field="reference"
                    label={autoReference ? "Reference" : "Reference (optional)"}
                    hint={autoReference?.hint}
                  >
                    {autoReference ? (
                      <Input
                        id="td-ref"
                        value={autoReference.value}
                        readOnly
                        placeholder={CASH_REFERENCE_PLACEHOLDER}
                        className="bg-muted font-mono text-muted-foreground"
                      />
                    ) : (
                      <Input
                        id="td-ref"
                        value={form.reference}
                        onChange={(e) => set("reference", e.target.value)}
                        placeholder="OR / transfer no."
                        maxLength={100}
                      />
                    )}
                  </FormField>
                )}
                <FormField
                  id="td-payout"
                  field="payout_account_id"
                  label="Pay the maturity into (optional)"
                  hint="A savings account of the member. Left blank, staff pay it out at maturity."
                  className={FORM_STEP_GRID.full}
                >
                  <OptionSelect
                    id="td-payout"
                    value={form.payoutAccountId}
                    onChange={(v) => set("payoutAccountId", v)}
                    options={[{ value: "", label: "No account: pay out at maturity" }, ...accountOptions]}
                    disabled={!form.member}
                  />
                </FormField>
              </div>
            </FormStep>

            <FormStep id="review">
              <PlacementPreview input={quote} />
            </FormStep>
          </FormStepper>
        </form>
      </DialogContent>
    </Dialog>
  );
}
