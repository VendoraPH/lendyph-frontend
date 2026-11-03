"use client";

import { useState, type ReactNode } from "react";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { savingsProductService } from "@/services/savings-product.service";
import type { SavingsSettings } from "@/types/savings";
import {
  MAX_PADDING,
  MIN_PADDING,
  accountNumberPreview,
  formToSettings,
  settingsToForm,
  type SettingsForm,
} from "../_lib/settings-form";

function Toggle({
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
    <div className="flex items-start justify-between gap-4">
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

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** The savings settings form, filled from what the server returned. */
export function SettingsEditor({ initial, onSaved }: { initial: SavingsSettings; onSaved: () => void }) {
  const [form, setForm] = useState<SettingsForm>(() => settingsToForm(initial));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const check = formToSettings(form);
    if (!check.ok) {
      notifyValidation(check.fields);
      return;
    }
    setSaving(true);
    savingsProductService
      .updateSettings(check.payload)
      .then(() => {
        notifySuccess("Savings settings saved");
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "We couldn't save the savings settings. Please try again."))
      .then(() => setSaving(false));
  };

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <Section title="Account numbers" description="How new savings account numbers are built. Numbers already issued never change.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ss-prefix">Prefix</Label>
            <Input
              id="ss-prefix"
              maxLength={10}
              placeholder="SA"
              value={form.account_number_prefix}
              onChange={(e) => set("account_number_prefix", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ss-padding">Sequence digits</Label>
            <Input
              id="ss-padding"
              type="number"
              min={MIN_PADDING}
              max={MAX_PADDING}
              value={form.account_number_padding}
              onChange={(e) => set("account_number_padding", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm" aria-live="polite">
              {accountNumberPreview(form)}
            </p>
          </div>
        </div>
        <Toggle
          id="ss-branch"
          label="Include branch code"
          hint="Adds the opening branch's code after the prefix."
          checked={form.account_number_include_branch}
          onChange={(v) => set("account_number_include_branch", v)}
        />
      </Section>

      <Section title="Interest" description="How the server counts days when it computes daily-balance interest.">
        <RadioGroup
          value={form.day_count_basis}
          onValueChange={(v) => set("day_count_basis", v === "actual" ? "actual" : "365")}
          className="space-y-2"
        >
          <label className="flex cursor-pointer items-start gap-3">
            <RadioGroupItem value="365" className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">365 days</span>
              <span className="block text-xs text-muted-foreground">Every year is divided by 365, leap years included.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <RadioGroupItem value="actual" className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Actual days</span>
              <span className="block text-xs text-muted-foreground">Leap years are divided by 366.</span>
            </span>
          </label>
        </RadioGroup>
      </Section>

      <Section title="Controls" description="Who must sign off, and when accounts change state on their own.">
        <Toggle
          id="ss-reversal-approval"
          label="Reversals need approval"
          hint="A second user with approval rights must approve each reversal. Nobody can approve their own."
          checked={form.require_reversal_approval}
          onChange={(v) => set("require_reversal_approval", v)}
        />
        <Toggle
          id="ss-interest-approval"
          label="Interest batches need approval"
          hint="A batch is approved by another user before it can be posted."
          checked={form.require_interest_approval}
          onChange={(v) => set("require_interest_approval", v)}
        />
        <Toggle
          id="ss-inactive-members"
          label="Inactive members may open accounts"
          hint="When off, only active members can open a savings account."
          checked={form.allow_inactive_member_opening}
          onChange={(v) => set("allow_inactive_member_opening", v)}
        />
        <div className="max-w-xs space-y-2">
          <Label htmlFor="ss-dormancy">Days before dormant</Label>
          <Input
            id="ss-dormancy"
            type="number"
            min={1}
            value={form.dormancy_days}
            onChange={(e) => set("dormancy_days", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Days with no member transaction before an account turns dormant.</p>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
