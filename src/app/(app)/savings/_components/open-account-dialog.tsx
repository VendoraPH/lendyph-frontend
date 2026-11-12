"use client";

import { useCallback, useState } from "react";
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
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { useApiResource, useDialogOpening, usePermission } from "@/hooks";
import type { MemberOption } from "@/hooks/use-member-search";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsAccount, SavingsMethod } from "@/types";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { parseMoneyInput } from "@/lib/money-input";
import { productChoice } from "@/lib/savings/product-choice";
import { useBooksReady } from "../_hooks/use-books-ready";
import { PAYMENT_METHOD_OPTIONS } from "../_lib/savings-rules";
import {
  EMPTY_OPENING_DETAILS,
  openingProductOptions,
  readOpeningDetails,
  type OpeningDetailsDraft,
} from "../_lib/opening-draft";
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
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, null)) {
    setForm({ ...EMPTY, openedAt: todayISO() });
    setDetails(EMPTY_OPENING_DETAILS);
    setSubmitted(false);
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
      .catch((err: unknown) => notifyError(err, "Couldn't open the account."));
  }

  const show = (error: string | null) => (submitted ? error : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open a savings account</DialogTitle>
          <DialogDescription>
            The opening deposit is posted as the account&apos;s first transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="sv-member" label="Member" error={show(memberError)}>
            <MemberSearchPicker
              id="sv-member"
              value={form.member}
              onChange={(m) => setForm((f) => ({ ...f, member: m, productId: "" }))}
              canSearch={can("borrowers:view")}
              placeholder="Search members"
              showCode
            />
          </FormField>

          {memberId !== null && <MemberCheckPanel check={check} />}

          <FormField
            id="sv-product"
            label="Product"
            error={show(productError)}
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
              placeholder={
                choosing
                  ? "Loading…"
                  : memberId === null
                    ? "Choose the member first"
                    : choice.selectable === 0
                      ? "No product to choose"
                      : "Choose a product"
              }
              disabled={choosing || memberId === null || choice.options.length === 0}
            />
            {emptyNotice && <ProductChoiceNotice empty={emptyNotice} />}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="sv-date" label="Opening date" error={show(dateError)}>
              <Input
                id="sv-date"
                type="date"
                value={form.openedAt}
                max={todayISO()}
                onChange={(e) => set("openedAt", e.target.value)}
              />
            </FormField>
            <FormField id="sv-amount" label="Opening deposit" error={show(amountError)}>
              <Input
                id="sv-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="sv-method" label="Received by">
              <OptionSelect
                id="sv-method"
                value={form.method}
                onChange={(v) => set("method", v as (typeof EMPTY)["method"])}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </FormField>
            <FormField id="sv-ref" label="Reference (optional)">
              <Input
                id="sv-ref"
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
                placeholder="OR / transfer no."
              />
            </FormField>
          </div>

          <OpeningDetailsFields
            value={details}
            onChange={(key, value) => setDetails((d) => ({ ...d, [key]: value }))}
            sourceError={show(opening.problems[0] ?? null)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Opening…" : "Open account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
