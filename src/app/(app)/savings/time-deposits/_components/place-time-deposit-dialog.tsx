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
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService, timeDepositService } from "@/services";
import type { MaturityInstruction, SavingsMethod, TimeDeposit } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { ProductChoiceNotice } from "../../_components/product-choice-notice";
import { useBooksReady } from "../../_hooks/use-books-ready";
import { productChoice, termChoice } from "@/lib/savings/product-choice";
import { METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "../../_lib/savings-rules";
import { MATURITY_INSTRUCTION_OPTIONS, termsOfferedText } from "../../_lib/time-deposit-rules";
import { checkPlacement, type PlacementForm } from "../_lib/placement-form";
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
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, null)) {
    setForm({ ...EMPTY, placementDate: todayISO() });
    setSubmitted(false);
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

  const { errors, quote, body } = checkPlacement({ ...form, memberId }, product);
  const show = (error: string | null) => (submitted ? error : null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setSubmitted(true);
    if (!body) return;
    run((key) => timeDepositService.place(body, key))
      ?.then((td) => {
        notifySuccess("Time deposit placed", td.certificate_number);
        onOpenChange(false);
        onPlaced(td);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't place the time deposit."));
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
              onChange={(m) => setForm((f) => ({ ...f, member: m, fundingAccountId: "", payoutAccountId: "" }))}
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
                placeholder={choosing ? "Loading…" : choice.selectable === 0 ? "No product to choose" : "Choose a product"}
                disabled={choosing || choice.options.length === 0}
              />
            </FormField>
            <FormField id="td-term" label="Term" error={show(errors.term)} hint={termsOfferedText(terms)}>
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
            <FormField id="td-method" label="Paid by">
              <OptionSelect
                id="td-method"
                value={form.method}
                onChange={(v) => set("method", v as SavingsMethod)}
                options={FUNDING_OPTIONS}
              />
            </FormField>
            {form.method === "savings" ? (
              <FormField id="td-funding" label="From account" error={show(errors.funding)}>
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
              <FormField id="td-ref" label="Reference (optional)">
                <Input id="td-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="OR / transfer no." />
              </FormField>
            )}
          </div>

          <FormField
            id="td-payout"
            label="Pay the maturity into (optional)"
            hint="A savings account of the member. Left blank, staff pay it out at maturity."
          >
            <OptionSelect
              id="td-payout"
              value={form.payoutAccountId}
              onChange={(v) => set("payoutAccountId", v)}
              options={[{ value: "", label: "No account: pay out at maturity" }, ...accountOptions]}
              disabled={!form.member}
            />
          </FormField>

          <PlacementPreview input={quote} />
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
