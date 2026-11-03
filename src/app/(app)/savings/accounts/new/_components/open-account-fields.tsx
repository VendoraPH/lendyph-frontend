"use client";

import { SubjectPicker } from "@/components/common/subject-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SavingsPaymentMethod, SavingsProduct } from "@/types/savings";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/payment-methods";
import type { OpenAccountForm } from "../_lib/open-account-form";

interface OpenAccountFieldsProps {
  form: OpenAccountForm;
  set: <K extends keyof OpenAccountForm>(key: K, value: OpenAccountForm[K]) => void;
  products: SavingsProduct[];
  productsLoading: boolean;
  today: string;
  /** Next number from the server's settings, or a placeholder until known. */
  accountNumberPreview: string | null;
}

const Required = () => <span className="text-destructive">*</span>;

export function OpenAccountFields({
  form,
  set,
  products,
  productsLoading,
  today,
  accountNumberPreview,
}: OpenAccountFieldsProps) {
  const productItems = products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <SubjectPicker subject="borrower" value={form.borrower_id} onChange={(id) => set("borrower_id", id)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="oa-product">
          Savings product <Required />
        </Label>
        <Select
          value={form.savings_product_id === null ? null : String(form.savings_product_id)}
          onValueChange={(v) => set("savings_product_id", v ? Number(v) : null)}
          items={productItems}
          disabled={productsLoading}
        >
          <SelectTrigger id="oa-product" className="w-full">
            <SelectValue placeholder={productsLoading ? "Loading products…" : "Choose an active product"} />
          </SelectTrigger>
          <SelectContent>
            {productItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Account number</Label>
        <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm text-muted-foreground">
          {accountNumberPreview ?? "Assigned when opened"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="oa-date">
          Date opened <Required />
        </Label>
        <Input
          id="oa-date"
          type="date"
          max={today}
          value={form.opened_at}
          onChange={(e) => set("opened_at", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="oa-amount">
          Initial deposit <Required />
        </Label>
        <Input
          id="oa-amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={form.initial_deposit}
          onChange={(e) => set("initial_deposit", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="oa-method">Payment method</Label>
        <Select
          value={form.payment_method}
          onValueChange={(v) => v && set("payment_method", v as SavingsPaymentMethod)}
          items={PAYMENT_METHOD_OPTIONS}
        >
          <SelectTrigger id="oa-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="oa-ref">Reference no.</Label>
        <Input
          id="oa-ref"
          placeholder="OR or slip number"
          value={form.reference_number}
          onChange={(e) => set("reference_number", e.target.value)}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="oa-remarks">Remarks</Label>
        <Textarea
          id="oa-remarks"
          rows={2}
          value={form.remarks}
          onChange={(e) => set("remarks", e.target.value)}
        />
      </div>
    </div>
  );
}
