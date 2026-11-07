"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/hooks/use-api-resource";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { IDENTIFIER_LABELS } from "@/lib/portal/labels";
import { portalAdminService } from "@/services/portal-admin.service";
import type { CreditScoreVisibility, PortalLoginIdentifier, PortalSettings } from "@/types/portal";
import { FeatureSwitches, NumberField, SwitchRow } from "./settings-fields";

/** Organisation-wide Member Portal configuration (member_portal:settings). */
export function PortalSettingsForm() {
  const fetcher = useCallback(() => portalAdminService.settings(), []);
  const resource = useApiResource(fetcher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Member Portal</h1>
        <p className="text-sm text-muted-foreground">
          What members see online, how they sign in, and which services are open to them.
        </p>
      </div>
      <DataState
        resource={resource}
        endpoints={["GET /portal-admin/settings", "PUT /portal-admin/settings"]}
        summary="Portal name, sign-in rules, password policy and which member services are switched on."
      >
        {(data) => <SettingsEditor initial={data} onSaved={resource.refetch} />}
      </DataState>
    </div>
  );
}

function SettingsEditor({ initial, onSaved }: { initial: PortalSettings; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleIdentifier = (id: PortalLoginIdentifier, on: boolean) =>
    set("login_identifiers", on ? [...form.login_identifiers, id] : form.login_identifiers.filter((x) => x !== id));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.portal_name.trim()) missing.push("Portal name");
    if (!form.terms_version.trim()) missing.push("Terms version");
    if (form.login_identifiers.length === 0) missing.push("At least one sign-in identifier");
    if (missing.length) return notifyValidation(missing);
    setSaving(true);
    portalAdminService
      .saveSettings(form)
      .then(() => {
        notifySuccess("Member Portal settings saved");
        onSaved();
      })
      .catch((err) => notifyError(err, "The settings could not be saved."))
      .finally(() => setSaving(false));
  };

  return (
    <form className="space-y-5" onSubmit={save}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            id="enabled"
            label="Member Portal is open"
            hint="When off, members see a maintenance notice and cannot sign in."
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="portal_name" label="Portal name" value={form.portal_name} onChange={(v) => set("portal_name", v)} />
            <Field
              id="support_contact"
              label="Support contact"
              value={form.support_contact ?? ""}
              onChange={(v) => set("support_contact", v || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="welcome">Welcome message</Label>
            <Textarea
              id="welcome"
              rows={2}
              value={form.welcome_message ?? ""}
              onChange={(e) => set("welcome_message", e.target.value || null)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="terms_url" label="Terms URL" value={form.terms_url ?? ""} onChange={(v) => set("terms_url", v || null)} />
            <Field
              id="privacy_url"
              label="Privacy notice URL"
              value={form.privacy_url ?? ""}
              onChange={(v) => set("privacy_url", v || null)}
            />
            <Field id="terms_version" label="Terms version" value={form.terms_version} onChange={(v) => set("terms_version", v)} />
          </div>
          <SwitchRow
            id="reaccept"
            label="Ask members to accept the terms again after a version change"
            checked={form.require_reacceptance}
            onChange={(v) => set("require_reacceptance", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access and sign-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            id="invitation_only"
            label="Invitation only"
            hint="Members can activate only after staff send an invitation."
            checked={form.invitation_only}
            onChange={(v) => set("invitation_only", v)}
          />
          <SwitchRow
            id="self_registration"
            label="Allow existing members to activate on their own"
            checked={form.self_registration}
            onChange={(v) => set("self_registration", v)}
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Members sign in with</legend>
            {(Object.keys(IDENTIFIER_LABELS) as PortalLoginIdentifier[]).map((id) => (
              <SwitchRow
                key={id}
                id={`identifier-${id}`}
                label={IDENTIFIER_LABELS[id]}
                checked={form.login_identifiers.includes(id)}
                onChange={(v) => toggleIdentifier(id, v)}
              />
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="otp_method">One-time codes are sent by</Label>
              <NativeSelect
                id="otp_method"
                className="w-full"
                value={form.otp_method}
                onChange={(e) => set("otp_method", e.target.value as PortalSettings["otp_method"])}
              >
                <NativeSelectOption value="sms">SMS</NativeSelectOption>
                <NativeSelectOption value="email">Email</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deceased_policy">When a member is marked deceased</Label>
              <NativeSelect
                id="deceased_policy"
                className="w-full"
                value={form.deceased_policy}
                onChange={(e) => set("deceased_policy", e.target.value as PortalSettings["deceased_policy"])}
              >
                <NativeSelectOption value="disable">Disable online access</NativeSelectOption>
                <NativeSelectOption value="read_only">Keep read-only for the estate</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField id="session" label="Session length (minutes)" min={5} value={form.session_minutes} onChange={(v) => set("session_minutes", v)} />
            <NumberField id="attempts" label="Failed sign-ins before lock" min={3} value={form.max_login_attempts} onChange={(v) => set("max_login_attempts", v)} />
            <NumberField id="lockout" label="Lockout (minutes)" min={1} value={form.lockout_minutes} onChange={(v) => set("lockout_minutes", v)} />
            <NumberField
              id="min_length"
              label="Minimum password length"
              min={8}
              value={form.password_rules.min_length}
              onChange={(v) => set("password_rules", { ...form.password_rules, min_length: v })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["require_uppercase", "Require an uppercase letter"],
                ["require_number", "Require a number"],
                ["require_symbol", "Require a symbol"],
              ] as const
            ).map(([key, label]) => (
              <SwitchRow
                key={key}
                id={key}
                label={label}
                checked={form.password_rules[key]}
                onChange={(v) => set("password_rules", { ...form.password_rules, [key]: v })}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeatureSwitches features={form.features} onChange={(f) => set("features", f)} />
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="credit_score">Credit score shown to members</Label>
            <NativeSelect
              id="credit_score"
              className="w-full"
              value={form.features.credit_score}
              onChange={(e) =>
                set("features", { ...form.features, credit_score: e.target.value as CreditScoreVisibility })
              }
            >
              <NativeSelectOption value="hidden">Hidden</NativeSelectOption>
              <NativeSelectOption value="category">Category only</NativeSelectOption>
              <NativeSelectOption value="score">Score</NativeSelectOption>
              <NativeSelectOption value="score_factors">Score and factors</NativeSelectOption>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <PermissionButton permission="member_portal:settings" type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </PermissionButton>
      </div>
    </form>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
