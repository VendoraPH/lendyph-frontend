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
import { useApiResource, useDialogOpening, usePermission } from "@/hooks";
import type { MemberOption } from "@/hooks/use-member-search";
import { FORM_STEP_GRID } from "@/lib/form-stepper";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsAccount, SavingsMethod } from "@/types";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { parseMoneyInput } from "@/lib/money-input";
import { productChoice, productPlaceholder } from "@/lib/savings/product-choice";
import { useBooksReady } from "../_hooks/use-books-ready";
import { PAYMENT_METHOD_OPTIONS } from "../_lib/savings-rules";
import {
  EMPTY_OPENING_DETAILS,
  heldProductIds,
  openingProductOptions,
  readOpeningDetails,
  type OpeningDetailsDraft,
} from "../_lib/opening-draft";
import { OPEN_ACCOUNT_STEPS, openAccountErrors } from "../_lib/open-account-steps";
import { errorsForStep, serverStepErrors } from "../_lib/step-errors";
import { FormField } from "./field";
import { MemberCheckPanel } from "./member-check-panel";
import { OpeningDetailsFields } from "./opening-details-fields";
import { OptionSelect } from "./option-select";
import { ProductChoiceNotice } from "./product-choice-notice";

interface OpenAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (account: SavingsAccount) => void;
}

const EMPTY = {
  member: null as MemberOption | null,
  productId: "",
  openedAt: "",
  amount: "",
  method: "cash" as Exclude<SavingsMethod, "savings">,
  reference: "",
};

export function OpenAccountDialog({ open, onOpenChange, onOpened }: OpenAccountDialogProps) {
  const { can } = usePermission();
  const [form, setForm] = useState(EMPTY);
  const [details, setDetails] = useState<OpeningDetailsDraft>(EMPTY_OPENING_DETAILS);
  const [submitted, setSubmitted] = useState(false);
  // Steps whose errors show: one that failed Next shows its own, before any save.
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<string>>(new Set());
  const stepperRef = useRef<FormStepperHandle>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, null)) {
    setForm({ ...EMPTY, openedAt: todayISO() });
    setDetails(EMPTY_OPENING_DETAILS);
    setSubmitted(false);
    setCheckedSteps(new Set());
  }

  const fetchProducts = useCallback(() => savingsService.products(), []);
  const products = useApiResource(fetchProducts, open);
  const memberId = form.member?.id ?? null;
  const fetchCheck = useCallback(() => savingsService.openingCheck(memberId ?? 0), [memberId]);
  const check = useApiResource(fetchCheck, open && memberId !== null);
  // The products the server says this member may open; every active regular
  // product only when the check couldn't be read (the server still checks).
  const checkFailed = !check.loading && (check.unavailable || check.error !== null);
  const eligibleIds =
    memberId === null || check.loading || checkFailed
      ? null
      : new Set(openingProductOptions(check.data).map((o) => o.value));
  const noneActive =
    products.data !== null && !products.data.some((p) => p.is_active && p.kind === "regular");
  const books = useBooksReady(open && noneActive);
  const choice = productChoice({
    products: products.data,
    kind: "regular",
    eligibleIds,
    heldProductIds: eligibleIds && check.data ? heldProductIds(check.data) : null,
    booksReady: books.ready,
    canManage: books.canManage,
  });
  const product =
    choice.options.some((o) => o.value === form.productId && !o.disabled)
      ? ((products.data ?? []).find((p) => String(p.id) === form.productId) ?? null)
      : null;
  // A member check still loading, or the settings behind the reason, show "Loading…", never a wrong message.
  // With no member chosen yet, only "no product is turned on" can show: it doesn't depend on the member.
  const choosing = products.loading || check.loading || books.loading;
  const emptyNotice = choosing ? null : choice.empty;
  const opening = readOpeningDetails(details);

  const amount = parseMoneyInput(form.amount, { label: "Opening deposit", allowZero: true });
  const memberError = form.member ? null : "Choose the member.";
  const productError = product ? null : "Choose a savings product.";
  const amountError = amount.ok ? null : amount.message;
  const dateError = form.openedAt ? null : "Enter the opening date.";
  const valid = !memberError && !productError && !amountError && !dateError && opening.problems.length === 0;
  const errors = openAccountErrors({
    memberError,
    productError,
    dateError,
    amountError,
    sourceError: opening.problems[0] ?? null,
  });

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setSubmitted(true);
    if (!valid || !form.member || !product || !amount.ok) return;
    const body = {
      borrower_id: form.member.id,
      product_id: product.id,
      opened_at: form.openedAt,
      initial_deposit: amount.value,
      payment_method: form.method,
      reference: form.reference.trim() || undefined,
      ...opening.input,
    };
    run((key) => savingsService.openAccount(body, key))
      ?.then((account) => {
        notifySuccess("Savings account opened", account.account_number);
        onOpenChange(false);
        onOpened(account);
      })
      .catch((err: unknown) => {
        stepperRef.current?.showErrors(serverStepErrors(err));
        notifyError(err, "Couldn't open the account.");
      });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  const show = (stepId: string, error: string | null) => (submitted || checkedSteps.has(stepId) ? error : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Open a savings account</DialogTitle>
          <DialogDescription>
            The opening deposit is posted as the account&apos;s first transaction.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormStepper
            ref={stepperRef}
            layout="dialog"
            steps={OPEN_ACCOUNT_STEPS}
            validateStep={(id) => errorsForStep(errors, OPEN_ACCOUNT_STEPS, id)}
            onInvalid={(_, id) => setCheckedSteps((steps) => new Set(steps).add(id))}
            submitLabel="Open account"
            submittingLabel="Opening…"
            submitting={submitting}
            actions={
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
            }
          >
            <FormStep id="member" className="space-y-4">
              <FormField id="sv-member" field="borrower_id" label="Member" error={show("member", memberError)}>
                <MemberSearchPicker
                  id="sv-member"
                  value={form.member}
                  onChange={(m) => setForm((f) => ({ ...f, member: m, productId: "" }))}
                  canSearch={can("borrowers:view")}
                  placeholder="Search members"
                  showCode
                />
              </FormField>

              {memberId !== null && (
                <MemberCheckPanel check={check} products={products.loading ? null : products.data} />
              )}

              <FormField
                id="sv-product"
                field="product_id"
                label="Product"
                error={show("member", productError)}
                hint={
                  products.unavailable
                    ? "Savings products aren't available yet."
                    : products.error
                      ? "Couldn't load the savings products. Close this and try again."
                      : product
                        ? `Opens with at least ${formatCurrency(product.minimum_opening_balance)}; maintaining balance ${formatCurrency(product.maintaining_balance)}.`
                        : undefined
                }
              >
                <OptionSelect
                  id="sv-product"
                  value={form.productId}
                  onChange={(v) => set("productId", v)}
                  options={choice.options}
                  placeholder={productPlaceholder({
                    choosing,
                    memberChosen: memberId !== null,
                    selectable: choice.selectable,
                  })}
                  disabled={choosing || memberId === null || choice.options.length === 0}
                />
                {emptyNotice && <ProductChoiceNotice empty={emptyNotice} />}
              </FormField>
            </FormStep>

            <FormStep id="deposit">
              <div className={FORM_STEP_GRID.roomy}>
                <FormField id="sv-date" field="opened_at" label="Opening date" error={show("deposit", dateError)}>
                  <Input
                    id="sv-date"
                    type="date"
                    value={form.openedAt}
                    max={todayISO()}
                    onChange={(e) => set("openedAt", e.target.value)}
                  />
                </FormField>
                <FormField
                  id="sv-amount"
                  field="initial_deposit"
                  label="Opening deposit"
                  error={show("deposit", amountError)}
                >
                  <Input
                    id="sv-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </FormField>
                <FormField id="sv-method" field="payment_method" label="Received by">
                  <OptionSelect
                    id="sv-method"
                    value={form.method}
                    onChange={(v) => set("method", v as (typeof EMPTY)["method"])}
                    options={PAYMENT_METHOD_OPTIONS}
                  />
                </FormField>
                <FormField id="sv-ref" field="reference" label="Reference (optional)">
                  <Input
                    id="sv-ref"
                    value={form.reference}
                    onChange={(e) => set("reference", e.target.value)}
                    placeholder="OR / transfer no."
                  />
                </FormField>
              </div>
            </FormStep>

            <FormStep id="details">
              <OpeningDetailsFields
                value={details}
                onChange={(key, value) => setDetails((d) => ({ ...d, [key]: value }))}
                sourceError={show("details", opening.problems[0] ?? null)}
              />
            </FormStep>
          </FormStepper>
        </form>
      </DialogContent>
    </Dialog>
  );
}
