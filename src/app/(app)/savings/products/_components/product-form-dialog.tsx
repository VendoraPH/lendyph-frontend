"use client";

import { useState, type ReactNode } from "react";
import { useDialogOpening, usePermission } from "@/hooks";
import { notifyValidation, notifyError } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dailyInterest } from "../../_lib/interest-preview";
import {
  EMPTY_SAVINGS_PRODUCT_FORM,
  INTEREST_METHOD_OPTIONS,
  POSTING_FREQUENCY_OPTIONS,
  formToPayload,
  type SavingsProductForm,
} from "../_lib/product-form";
import type { SavingsProductPayload } from "@/types/savings";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolve to close the dialog; reject (with the API error) to keep it open. */
  onSubmit: (payload: SavingsProductPayload) => Promise<void>;
  initialData?: SavingsProductForm;
  title: string;
  description: string;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  required,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** "₱100,000 at 2% earns ₱5.48 a day" — an illustration, never a posting. */
function RateExample({ rate }: { rate: string }) {
  const pct = Number(rate);
  if (!(pct > 0)) return null;
  const year = new Date().getFullYear();
  const perDay = dailyInterest(100_000, pct, "365", year);
  return (
    <p className="text-xs text-muted-foreground">
      Example: {formatCurrency(100_000)} kept for a year earns about {formatCurrency(perDay)} a day
      (daily balance × rate ÷ 365). Posted interest is computed by the server.
    </p>
  );
}

export function ProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
}: ProductFormDialogProps) {
  const canSetRates = usePermission().can("savings:settings");
  const [form, setForm] = useState<SavingsProductForm>(initialData ?? EMPTY_SAVINGS_PRODUCT_FORM);
  const [saving, setSaving] = useState(false);

  if (useDialogOpening(open, initialData)) {
    setForm(initialData ?? EMPTY_SAVINGS_PRODUCT_FORM);
  }

  const set = <K extends keyof SavingsProductForm>(key: K, value: SavingsProductForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const check = formToPayload(form, canSetRates);
    if (!check.ok) {
      if (check.message) notifyError(null, check.message);
      else notifyValidation(check.fields);
      return;
    }
    setSaving(true);
    onSubmit(check.payload)
      .then(() => onOpenChange(false))
      .catch((err: unknown) => notifyError(err, "We couldn't save this savings product. Please try again."))
      .then(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="max-h-[65vh] space-y-6 overflow-y-auto overflow-x-hidden px-1"
          noValidate
        >
          <Section title="Basic info">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sp-code">
                  Product code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sp-code"
                  placeholder="e.g. RS"
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sp-name">
                  Product name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sp-name"
                  placeholder="e.g. Regular Savings"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sp-type">
                  Product type <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sp-type"
                  placeholder="e.g. Regular, Junior, Time deposit"
                  value={form.product_type}
                  onChange={(e) => set("product_type", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v === "inactive" ? "inactive" : "active")}>
                  <SelectTrigger id="sp-status" className="w-full">
                    <SelectValue>{(v: string | null) => (v === "inactive" ? "Inactive" : "Active")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-description">Description</Label>
              <Textarea
                id="sp-description"
                placeholder="What this product is for"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </Section>

          <Section title="Balances">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MoneyField
                id="sp-min-initial"
                label="Minimum initial deposit"
                value={form.min_initial_deposit}
                onChange={(v) => set("min_initial_deposit", v)}
                required
              />
              <MoneyField
                id="sp-maintaining"
                label="Minimum maintaining balance"
                value={form.min_maintaining_balance}
                onChange={(v) => set("min_maintaining_balance", v)}
                required
                hint="Withdrawals can't take the balance below this."
              />
              <MoneyField
                id="sp-earn"
                label="Minimum balance to earn interest"
                value={form.min_balance_to_earn_interest}
                onChange={(v) => set("min_balance_to_earn_interest", v)}
                required
                hint="Days below this earn no interest."
              />
            </div>
          </Section>

          <Section title="Interest">
            {!canSetRates && (
              <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                Changing interest settings needs the savings settings permission.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sp-rate">
                  Annual interest rate (%){" "}
                  {canSetRates && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="sp-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.000001"
                  placeholder="2"
                  value={form.interest_rate}
                  onChange={(e) => set("interest_rate", e.target.value)}
                  disabled={!canSetRates}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-method">Computation method</Label>
                <Select
                  value={form.interest_method}
                  onValueChange={(v) => v && set("interest_method", v as SavingsProductForm["interest_method"])}
                  disabled={!canSetRates}
                >
                  <SelectTrigger id="sp-method" className="w-full">
                    <SelectValue>
                      {(v: string | null) => INTEREST_METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-posting">Posting frequency</Label>
                <Select
                  value={form.posting_frequency}
                  onValueChange={(v) => v && set("posting_frequency", v as SavingsProductForm["posting_frequency"])}
                  disabled={!canSetRates}
                >
                  <SelectTrigger id="sp-posting" className="w-full">
                    <SelectValue>
                      {(v: string | null) => POSTING_FREQUENCY_OPTIONS.find((o) => o.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {POSTING_FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <RateExample rate={form.interest_rate} />
          </Section>

          <Section title="Rules">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToggleRow
                id="sp-allow-deposits"
                label="Allow deposits"
                hint="Members can add money to accounts on this product."
                checked={form.allow_deposits}
                onChange={(v) => set("allow_deposits", v)}
              />
              <ToggleRow
                id="sp-allow-withdrawals"
                label="Allow withdrawals"
                hint="Members can take money out, down to the maintaining balance."
                checked={form.allow_withdrawals}
                onChange={(v) => set("allow_withdrawals", v)}
              />
              <ToggleRow
                id="sp-multiple"
                label="Allow multiple accounts"
                hint="One member may hold more than one account on this product."
                checked={form.allow_multiple_accounts}
                onChange={(v) => set("allow_multiple_accounts", v)}
              />
              <MoneyField
                id="sp-max-withdrawal"
                label="Maximum per withdrawal"
                value={form.max_withdrawal_amount}
                onChange={(v) => set("max_withdrawal_amount", v)}
                placeholder="No limit"
                hint="Leave blank for no limit."
              />
            </div>
          </Section>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving ? "Saving…" : initialData ? "Save changes" : "Create product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
