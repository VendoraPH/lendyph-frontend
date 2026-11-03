"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SavingsPaymentMethod } from "@/types/savings";
import { PAYMENT_METHOD_OPTIONS } from "../_lib/payment-methods";

/** The fields every money movement shares; transfers have no payment method. */
export interface TransactionFieldValues {
  amount: string;
  transaction_date: string;
  payment_method?: SavingsPaymentMethod;
  reference_number: string;
  remarks: string;
}

interface TransactionFieldsProps<F extends TransactionFieldValues> {
  idPrefix: string;
  amountLabel: string;
  form: F;
  set: <K extends keyof F>(key: K, value: F[K]) => void;
  today: string;
  disabled?: boolean;
}

const Required = () => <span className="text-destructive">*</span>;

/** Amount, date, payment method (when the form has one), reference and remarks. */
export function TransactionFields<F extends TransactionFieldValues>({
  idPrefix,
  amountLabel,
  form,
  set,
  today,
  disabled,
}: TransactionFieldsProps<F>) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={id("amount")}>
          {amountLabel} <Required />
        </Label>
        <Input
          id={id("amount")}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => set("amount", e.target.value as F["amount"])}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("date")}>
          Transaction date <Required />
        </Label>
        <Input
          id={id("date")}
          type="date"
          max={today}
          value={form.transaction_date}
          onChange={(e) => set("transaction_date", e.target.value as F["transaction_date"])}
          disabled={disabled}
        />
      </div>
      {form.payment_method !== undefined && (
        <div className="space-y-2">
          <Label htmlFor={id("method")}>Payment method</Label>
          <Select
            value={form.payment_method}
            onValueChange={(v) => v && set("payment_method", v as F["payment_method"])}
            items={PAYMENT_METHOD_OPTIONS}
            disabled={disabled}
          >
            <SelectTrigger id={id("method")} className="w-full">
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
      )}
      <div className="space-y-2">
        <Label htmlFor={id("reference")}>Reference no.</Label>
        <Input
          id={id("reference")}
          placeholder="Optional, e.g. OR or check number"
          value={form.reference_number}
          onChange={(e) => set("reference_number", e.target.value as F["reference_number"])}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id("remarks")}>Remarks</Label>
        <Textarea
          id={id("remarks")}
          rows={2}
          value={form.remarks}
          onChange={(e) => set("remarks", e.target.value as F["remarks"])}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
