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
import type { SavingsAccount } from "@/types";
import {
  PAYMENT_METHOD_OPTIONS,
  openingDepositProblem,
  parseAmountInput,
} from "../_lib/savings-rules";
import { FormField } from "./field";
import { OptionSelect } from "./option-select";

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
  method: "cash",
  reference: "",
};

export function OpenAccountDialog({ open, onOpenChange, onOpened }: OpenAccountDialogProps) {
  const { can } = usePermission();
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, null)) {
    setForm({ ...EMPTY, openedAt: todayISO() });
    setSubmitted(false);
  }

  const fetchProducts = useCallback(() => savingsService.products(), []);
  const products = useApiResource(fetchProducts, open);
  const openable = (products.data ?? []).filter((p) => p.is_active && p.kind === "regular");
  const product = openable.find((p) => String(p.id) === form.productId) ?? null;

  const amount = parseAmountInput(form.amount);
  const memberError = form.member ? null : "Choose the member.";
  const productError = product ? null : "Choose a savings product.";
  const amountError = openingDepositProblem(amount, product);
  const dateError = form.openedAt ? null : "Enter the opening date.";
  const valid = !memberError && !productError && !amountError && !dateError;

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setSubmitted(true);
    if (!valid || !form.member || !product || amount === null) return;
    setSubmitting(true);
    savingsService
      .openAccount({
        borrower_id: form.member.id,
        product_id: product.id,
        opened_at: form.openedAt,
        initial_deposit: amount,
        payment_method: form.method,
        reference: form.reference.trim() || undefined,
      })
      .then((account) => {
        notifySuccess("Savings account opened", account.account_number);
        onOpenChange(false);
        onOpened(account);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't open the account."))
      .then(() => setSubmitting(false));
  }

  const show = (error: string | null) => (submitted ? error : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
              onChange={(m) => set("member", m)}
              canSearch={can("borrowers:view")}
              placeholder="Search members"
              showCode
            />
          </FormField>

          <FormField
            id="sv-product"
            label="Product"
            error={show(productError)}
            hint={
              products.unavailable
                ? "Savings products are not connected yet."
                : product
                  ? `Opens with at least ${formatCurrency(product.minimum_opening_balance)}; maintaining balance ${formatCurrency(product.maintaining_balance)}.`
                  : undefined
            }
          >
            <OptionSelect
              id="sv-product"
              value={form.productId}
              onChange={(v) => set("productId", v)}
              options={openable.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
              placeholder={products.loading ? "Loading…" : "Choose a product"}
              disabled={products.loading || openable.length === 0}
            />
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
                onChange={(v) => set("method", v)}
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
