"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useBranches, useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import {
  CHANNEL_LABELS,
  MAX_RULE_DAYS,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  TRIGGER_LABELS,
  describeRule,
  formatSendTime,
  validateRule,
  type ContactWindow,
} from "@/lib/reminders";
import { reminderService } from "@/services";
import type {
  BorrowerType,
  ReminderChannel,
  ReminderRule,
  ReminderRuleInput,
  ReminderTemplateType,
  ReminderTrigger,
} from "@/types/reminder";
import { useLoanProducts } from "../../_hooks/use-loan-products";

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` creates; a rule edits it. */
  rule: ReminderRule | null;
  /** Prefill for a new rule, e.g. one of the suggested defaults. */
  draft?: Partial<ReminderRuleInput>;
  contactHours: ContactWindow;
  onSaved: () => void;
}

const EMPTY: ReminderRuleInput = {
  name: "",
  trigger: "before_due",
  days: 3,
  send_time: "09:00",
  channels: ["sms"],
  branch_id: null,
  loan_product_id: null,
  borrower_type: "all",
  template_type: "upcoming",
  is_active: true,
};

const BORROWER_TYPES: { value: BorrowerType; label: string }[] = [
  { value: "all", label: "All borrowers" },
  { value: "member", label: "Members only" },
  { value: "non_member", label: "Walk-ins only" },
];

const TRIGGERS = Object.keys(TRIGGER_LABELS) as ReminderTrigger[];
const CHANNELS = Object.keys(CHANNEL_LABELS) as ReminderChannel[];

function toInput(rule: ReminderRule): ReminderRuleInput {
  return {
    name: rule.name,
    trigger: rule.trigger,
    days: rule.days,
    send_time: rule.send_time,
    channels: rule.channels,
    branch_id: rule.branch_id,
    loan_product_id: rule.loan_product_id,
    borrower_type: rule.borrower_type,
    template_type: rule.template_type,
    is_active: rule.is_active,
  };
}

export function RuleFormDialog({ open, onOpenChange, rule, draft, contactHours, onSaved }: RuleFormDialogProps) {
  const { branches } = useBranches();
  const { products, error: productsError } = useLoanProducts();
  const [form, setForm] = useState<ReminderRuleInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  if (useDialogOpening(open, rule ?? draft)) {
    setForm(rule ? toInput(rule) : { ...EMPTY, ...draft });
  }

  const set = <K extends keyof ReminderRuleInput>(key: K, value: ReminderRuleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setTrigger = (trigger: ReminderTrigger) =>
    setForm((f) => ({ ...f, trigger, days: trigger === "on_due" ? 0 : f.days || 1 }));

  const toggleChannel = (channel: ReminderChannel, on: boolean) =>
    setForm((f) => ({
      ...f,
      channels: on ? [...new Set([...f.channels, channel])] : f.channels.filter((c) => c !== channel),
    }));

  // A rule's product that isn't in the list (still loading, failed to load, or
  // since retired) still gets an option, so the picker shows the rule's real
  // scope instead of falling back to "All products" while saving the id.
  const productMissing =
    form.loan_product_id !== null && !products.some((p) => p.id === form.loan_product_id);

  const save = () => {
    const problems = validateRule(form, contactHours);
    if (problems.length) {
      notifyValidation(problems);
      return;
    }
    setSaving(true);
    const payload = { ...form, name: form.name.trim() };
    const request = rule ? reminderService.updateRule(rule.id, payload) : reminderService.createRule(payload);
    request
      .then(() => {
        setSaving(false);
        notifySuccess(rule ? "Rule updated" : "Rule created");
        onOpenChange(false);
        onSaved();
      })
      .catch((err) => {
        setSaving(false);
        notifyError(err, "Could not save the rule.");
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit reminder rule" : "New reminder rule"}</DialogTitle>
          <DialogDescription>{describeRule(form)}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input id="rule-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-trigger">When</Label>
            <NativeSelect
              id="rule-trigger"
              className="w-full"
              value={form.trigger}
              onChange={(e) => setTrigger(e.target.value as ReminderTrigger)}
            >
              {TRIGGERS.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {TRIGGER_LABELS[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-days">Days</Label>
            <Input
              id="rule-days"
              type="number"
              min={form.trigger === "on_due" ? 0 : 1}
              max={MAX_RULE_DAYS}
              disabled={form.trigger === "on_due"}
              value={form.days}
              onChange={(e) => set("days", Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-time">Send time</Label>
            <Input
              id="rule-time"
              type="time"
              value={form.send_time}
              onChange={(e) => set("send_time", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must fall within contact hours ({formatSendTime(contactHours.start)}–{formatSendTime(contactHours.end)}).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-template">Template</Label>
            <NativeSelect
              id="rule-template"
              className="w-full"
              value={form.template_type}
              onChange={(e) => set("template_type", e.target.value as ReminderTemplateType)}
            >
              {TEMPLATE_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {TEMPLATE_TYPE_LABELS[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Channels</legend>
            <div className="flex flex-wrap gap-6">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Switch checked={form.channels.includes(c)} onCheckedChange={(on) => toggleChannel(c, on)} />
                  {CHANNEL_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="rule-branch">Branch</Label>
            <NativeSelect
              id="rule-branch"
              className="w-full"
              value={form.branch_id ?? ""}
              onChange={(e) => set("branch_id", e.target.value ? Number(e.target.value) : null)}
            >
              <NativeSelectOption value="">All branches</NativeSelectOption>
              {branches.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-product">Loan product</Label>
            <NativeSelect
              id="rule-product"
              className="w-full"
              value={form.loan_product_id ?? ""}
              onChange={(e) => set("loan_product_id", e.target.value ? Number(e.target.value) : null)}
            >
              <NativeSelectOption value="">All products</NativeSelectOption>
              {productMissing && form.loan_product_id !== null && (
                <NativeSelectOption value={form.loan_product_id}>
                  {rule?.loan_product_id === form.loan_product_id && rule.loan_product_name
                    ? rule.loan_product_name
                    : "This rule's product"}
                </NativeSelectOption>
              )}
              {products.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {productsError && (
              <p className="text-xs text-muted-foreground">
                {productsError} You can still apply the rule to all products, or reload the page to try again.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-borrowers">Borrower type</Label>
            <NativeSelect
              id="rule-borrowers"
              className="w-full"
              value={form.borrower_type}
              onChange={(e) => set("borrower_type", e.target.value as BorrowerType)}
            >
              {BORROWER_TYPES.map((b) => (
                <NativeSelectOption key={b.value} value={b.value}>
                  {b.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Switch checked={form.is_active} onCheckedChange={(on) => set("is_active", on)} />
            Active
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : rule ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
