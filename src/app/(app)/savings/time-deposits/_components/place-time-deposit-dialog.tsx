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
import { formatCurrency, formatRate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { MaturityInstruction, TimeDeposit } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { PAYMENT_METHOD_OPTIONS, parseAmountInput, toAmount } from "../../_lib/savings-rules";
import { MATURITY_INSTRUCTION_OPTIONS, placementProblem, termLabel } from "../../_lib/time-deposit-rules";
import { PlacementPreview } from "./placement-preview";

interface PlaceTimeDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlaced: (td: TimeDeposit) => void;
}

const EMPTY = {
  member: null as MemberOption | null,
  productId: "",
  term: "",
  placementDate: "",
  amount: "",
  instruction: "payout" as MaturityInstruction,
  method: "cash",
  reference: "",
};

export function PlaceTimeDepositDialog({ open, onOpenChange, onPlaced }: PlaceTimeDepositDialogProps) {
  const { can } = usePermission();
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, null)) {
    setForm({ ...EMPTY, placementDate: todayISO() });
    setSubmitted(false);
  }

  const fetchProducts = useCallback(() => savingsService.products(), []);
  const products = useApiResource(fetchProducts, open);
  const placeable = (products.data ?? []).filter((p) => p.is_active && p.kind === "time_deposit");
  const product = placeable.find((p) => String(p.id) === form.productId) ?? null;
  const terms = product?.term_options_days ?? [];
  const term = terms.includes(Number(form.term)) ? Number(form.term) : null;

  const amount = parseAmountInput(form.amount);
  const errors = {
    member: form.member ? null : "Choose the member.",
    product: product ? null : "Choose a time deposit product.",
    term: term ? null : "Choose the term.",
    amount: placementProblem(amount, product),
    date: form.placementDate ? null : "Enter the placement date.",
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (error: string | null) => (submitted ? error : null);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setSubmitted(true);
    if (!valid || !form.member || !product || !term || amount === null) return;
    setSubmitting(true);
    savingsService
      .placeTimeDeposit({
        borrower_id: form.member.id,
        product_id: product.id,
        principal: amount,
        term_days: term,
        placement_date: form.placementDate,
        maturity_instruction: form.instruction,
        payment_method: form.method,
        reference: form.reference.trim() || undefined,
      })
      .then((td) => {
        notifySuccess("Time deposit placed", td.certificate_number);
        onOpenChange(false);
        onPlaced(td);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't place the time deposit."))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Place a time deposit</DialogTitle>
          <DialogDescription>The rate is fixed for the term. The certificate can be printed once it is placed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="td-member" label="Member" error={show(errors.member)}>
            <MemberSearchPicker
              id="td-member"
              value={form.member}
              onChange={(m) => set("member", m)}
              canSearch={can("borrowers:view")}
              placeholder="Search members"
              showCode
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="td-product"
              label="Product"
              error={show(errors.product)}
              hint={
                products.unavailable
                  ? "Savings products are not connected yet."
                  : product
                    ? `${formatRate(product.annual_interest_rate)}% a year; at least ${formatCurrency(product.minimum_opening_balance)}.`
                    : undefined
              }
            >
              <OptionSelect
                id="td-product"
                value={form.productId}
                onChange={(v) => setForm((f) => ({ ...f, productId: v, term: "" }))}
                options={placeable.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
                placeholder={products.loading ? "Loading…" : "Choose a product"}
                disabled={products.loading || placeable.length === 0}
              />
            </FormField>
            <FormField id="td-term" label="Term" error={show(errors.term)}>
              <OptionSelect
                id="td-term"
                value={form.term}
                onChange={(v) => set("term", v)}
                options={terms.map((d) => ({ value: String(d), label: termLabel(d) }))}
                placeholder={product ? "Choose a term" : "Choose a product first"}
                disabled={terms.length === 0}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="td-amount" label="Amount placed" error={show(errors.amount)}>
              <Input id="td-amount" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </FormField>
            <FormField id="td-date" label="Placement date" error={show(errors.date)}>
              <Input id="td-date" type="date" value={form.placementDate} max={todayISO()} onChange={(e) => set("placementDate", e.target.value)} />
            </FormField>
          </div>

          <FormField id="td-instruction" label="At maturity">
            <OptionSelect id="td-instruction" value={form.instruction} onChange={(v) => set("instruction", v as MaturityInstruction)} options={MATURITY_INSTRUCTION_OPTIONS} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="td-method" label="Received by">
              <OptionSelect id="td-method" value={form.method} onChange={(v) => set("method", v)} options={PAYMENT_METHOD_OPTIONS} />
            </FormField>
            <FormField id="td-ref" label="Reference (optional)">
              <Input id="td-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="OR / transfer no." />
            </FormField>
          </div>

          {product && term && amount !== null && form.placementDate && (
            <PlacementPreview
              principal={amount}
              ratePct={toAmount(product.annual_interest_rate)}
              termDays={term}
              withholdingPct={toAmount(product.withholding_tax_rate)}
              placementDate={form.placementDate}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Placing…" : "Place time deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
