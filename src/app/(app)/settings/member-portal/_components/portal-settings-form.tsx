"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDateTime } from "@/lib/format";
import { notifyInfo, notifySuccess } from "@/lib/notify";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalDashboardCard, PortalFeature, PortalSettings, PortalWithdrawalMethod } from "@/types/portal-admin";
import { FormField } from "@/app/(app)/savings/_components/field";
import { DASHBOARD_CARD_LABELS, FEATURE_LABELS, WITHDRAWAL_METHOD_LABELS, optionsOf } from "@/app/(app)/member-portal/_lib/labels";
import { notifyPortalError } from "@/app/(app)/member-portal/_lib/notify-portal-error";
import {
  NUMBER_FIELDS,
  formOf,
  otpSwitchDisabled,
  settingsBody,
  settingsProblems,
  type SettingsForm,
} from "../_lib/settings-form";

const toggle = <T,>(list: T[], value: T, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));
const FEATURES = optionsOf(FEATURE_LABELS);
const CARDS = optionsOf(DASHBOARD_CARD_LABELS);
const METHODS = optionsOf(WITHDRAWAL_METHOD_LABELS);
const SECURITY = NUMBER_FIELDS.slice(0, 8);
const REQUESTS = NUMBER_FIELDS.slice(8);

function SwitchRow({ id, label, hint, checked, disabled, onChange }: {
  id: string;
  label: string;
  hint?: string | null;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={(on) => onChange(on === true)} />
    </div>
  );
}

/**
 * The portal's settings. Only what changed is sent. One-time passwords stay
 * off while the server says they can't reach members (`otp_blocked_reason`).
 * Carried over from #511 by Augustin, without self-registration, sign-in
 * identifiers or an OTP method.
 */
export function PortalSettingsForm({ settings, onSaved }: { settings: PortalSettings; onSaved: () => void }) {
  const [form, setForm] = useState<SettingsForm>(() => formOf(settings));
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  const problems = settingsProblems(form);
  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setNumber = (key: keyof SettingsForm["numbers"], value: string) =>
    setForm((f) => ({ ...f, numbers: { ...f.numbers, [key]: value } }));

  function save() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    const body = settingsBody(form, settings);
    if (Object.keys(body).length === 0) {
      notifyInfo("Nothing to save");
      return;
    }
    run(() => portalAdminService.updateSettings(body))
      ?.then(() => {
        notifySuccess("Member Portal settings saved");
        onSaved();
      })
      .catch((err: unknown) => notifyPortalError(err, "The settings couldn't be saved."));
  }

  const numberInput = (f: (typeof NUMBER_FIELDS)[number]) => (
    <FormField key={f.key} id={`mp-${f.key}`} label={f.label} error={submitted ? (problems[f.key] ?? null) : null} hint={`${f.min} to ${f.max}`}>
      <Input
        id={`mp-${f.key}`}
        inputMode="numeric"
        value={form.numbers[f.key]}
        onChange={(e) => setNumber(f.key, e.target.value)}
      />
    </FormField>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The portal</CardTitle>
          <CardDescription>
            {settings.updated_by
              ? `Last changed by ${settings.updated_by.name}${settings.updated_at ? `, ${formatDateTime(settings.updated_at)}` : ""}.`
              : "Not changed yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            id="mp-enabled"
            label="Member Portal is on"
            hint={settings.terms ? "Members can sign in." : "Publish the terms below before turning the portal on."}
            checked={form.enabled}
            disabled={!settings.terms && !settings.enabled}
            onChange={(on) => set("enabled", on)}
          />
          <FormField id="mp-name" label="Portal name" error={submitted ? (problems.portal_name ?? null) : null}>
            <Input id="mp-name" maxLength={100} value={form.portal_name} onChange={(e) => set("portal_name", e.target.value)} />
          </FormField>
          <FormField id="mp-welcome" label="Welcome message (optional)">
            <Textarea id="mp-welcome" rows={2} maxLength={1000} value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
          </FormField>
          <FormField id="mp-support" label="Support contact (optional)" hint="Shown to members, for example the branch's phone number.">
            <Input id="mp-support" maxLength={255} value={form.support_contact} onChange={(e) => set("support_contact", e.target.value)} />
          </FormField>
          <FormField id="mp-pay" label="How to pay (optional)" hint="Shown to members beside their loans.">
            <Textarea id="mp-pay" rows={2} maxLength={2000} value={form.payment_instructions} onChange={(e) => set("payment_instructions", e.target.value)} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signing in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">{SECURITY.map(numberInput)}</div>
          <SwitchRow
            id="mp-otp"
            label="Ask for a one-time password by text message"
            hint={otpSwitchDisabled(settings) ? settings.otp_blocked_reason : "Sent to the member's registered mobile when they use a code."}
            checked={form.otp_required}
            disabled={otpSwitchDisabled(settings)}
            onChange={(on) => set("otp_required", on)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What members can see and ask for</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Parts of the portal</legend>
            {FEATURES.map((f) => (
              <SwitchRow
                key={f.value}
                id={`mp-feature-${f.value}`}
                label={f.label}
                checked={form.features[f.value as PortalFeature] !== false}
                onChange={(on) => set("features", { ...form.features, [f.value]: on })}
              />
            ))}
          </fieldset>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Dashboard cards</legend>
            {CARDS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.dashboard_cards.includes(c.value)}
                  onCheckedChange={(on) => set("dashboard_cards", toggle<PortalDashboardCard>(form.dashboard_cards, c.value, on === true))}
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Withdrawal payout methods</legend>
            {METHODS.map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.withdrawal_methods.includes(m.value)}
                  onCheckedChange={(on) =>
                    set("withdrawal_methods", toggle<PortalWithdrawalMethod>(form.withdrawal_methods, m.value, on === true))
                  }
                />
                {m.label}
              </label>
            ))}
            {submitted && problems.withdrawal_methods && <p className="text-xs text-destructive">{problems.withdrawal_methods}</p>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">{REQUESTS.map(numberInput)}</div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
