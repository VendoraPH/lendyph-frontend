"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { CONTACT_HOURS_LIMIT, formatSendTime, validateContactWindow } from "@/lib/reminders";
import { reminderService } from "@/services";
import type {
  BranchReminderConfig,
  EmailProvider,
  ReminderSettings,
  ReminderSettingsUpdate,
  SmsProvider,
} from "@/types/reminder";

const MAX_RETRY_ATTEMPTS = 3;

const SMS_PROVIDERS: { value: SmsProvider; label: string }[] = [
  { value: "semaphore", label: "Semaphore" },
  { value: "m360", label: "M360" },
  { value: "twilio", label: "Twilio" },
  { value: "other", label: "Other" },
];

const EMAIL_PROVIDERS: { value: EmailProvider; label: string }[] = [
  { value: "smtp", label: "SMTP" },
  { value: "mailgun", label: "Mailgun" },
  { value: "ses", label: "Amazon SES" },
  { value: "postmark", label: "Postmark" },
  { value: "other", label: "Other" },
];

const TIMEZONES = ["Asia/Manila"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The form's copy of the settings, with the write-only credentials blank. */
function toForm(s: ReminderSettings): ReminderSettingsUpdate {
  const sms = s.sms_provider;
  const email = s.email_provider;
  return {
    ...s,
    sms_provider: {
      provider: sms.provider,
      sender_id: sms.sender_id,
      cost_per_segment: sms.cost_per_segment,
      api_key: "",
      api_secret: "",
    },
    email_provider: {
      provider: email.provider,
      sender_name: email.sender_name,
      sender_email: email.sender_email,
      reply_to: email.reply_to,
      api_key: "",
    },
  };
}

/** Blank credential fields mean "keep what is stored", so they are not sent. */
function toPayload(form: ReminderSettingsUpdate): ReminderSettingsUpdate {
  const { api_key: smsKey, api_secret: smsSecret, ...sms } = form.sms_provider;
  const { api_key: emailKey, ...email } = form.email_provider;
  return {
    ...form,
    sms_provider: {
      ...sms,
      ...(smsKey?.trim() ? { api_key: smsKey.trim() } : {}),
      ...(smsSecret?.trim() ? { api_secret: smsSecret.trim() } : {}),
    },
    email_provider: { ...email, ...(emailKey?.trim() ? { api_key: emailKey.trim() } : {}) },
  };
}

function validate(form: ReminderSettingsUpdate): string[] {
  const problems: string[] = [];
  const windowProblem = validateContactWindow(form.contact_hours);
  if (windowProblem) problems.push(windowProblem);
  else if (form.default_send_time < form.contact_hours.start || form.default_send_time > form.contact_hours.end) {
    problems.push("Default send time (within contact hours)");
  }
  if (form.enabled && !form.channels.sms && !form.channels.email) problems.push("At least one channel");
  if (!Number.isInteger(form.retry.max_attempts) || form.retry.max_attempts < 0 || form.retry.max_attempts > MAX_RETRY_ATTEMPTS) {
    problems.push(`Retry attempts (0–${MAX_RETRY_ATTEMPTS})`);
  }
  if (!Number.isInteger(form.retry.delay_minutes) || form.retry.delay_minutes < 1) problems.push("Retry delay (minutes)");
  if (form.channels.sms && !form.sms_provider.sender_id.trim()) problems.push("SMS sender ID");
  if (form.channels.email) {
    if (!EMAIL_PATTERN.test(form.email_provider.sender_email)) problems.push("Sender email");
    if (form.email_provider.reply_to && !EMAIL_PATTERN.test(form.email_provider.reply_to)) problems.push("Reply-to email");
  }
  return problems;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <p className="font-semibold">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function secretHint(saved: boolean): string {
  return saved ? "•••• saved. Leave blank to keep it." : "Not set yet.";
}

export function SettingsForm({ settings, onSaved }: { settings: ReminderSettings; onSaved: () => void }) {
  const [form, setForm] = useState<ReminderSettingsUpdate>(() => toForm(settings));
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<ReminderSettingsUpdate>) => setForm((f) => ({ ...f, ...p }));
  const patchSms = (p: Partial<ReminderSettingsUpdate["sms_provider"]>) =>
    setForm((f) => ({ ...f, sms_provider: { ...f.sms_provider, ...p } }));
  const patchEmail = (p: Partial<ReminderSettingsUpdate["email_provider"]>) =>
    setForm((f) => ({ ...f, email_provider: { ...f.email_provider, ...p } }));
  const patchBranch = (branchId: number, p: Partial<BranchReminderConfig>) =>
    setForm((f) => ({ ...f, branches: f.branches.map((b) => (b.branch_id === branchId ? { ...b, ...p } : b)) }));

  const save = () => {
    const problems = validate(form);
    if (problems.length) {
      notifyValidation(problems);
      return;
    }
    setSaving(true);
    reminderService
      .updateSettings(toPayload(form))
      .then(() => {
        setSaving(false);
        // Credentials are never echoed back; clear what was typed.
        setForm((f) => ({
          ...f,
          sms_provider: { ...f.sms_provider, api_key: "", api_secret: "" },
          email_provider: { ...f.email_provider, api_key: "" },
        }));
        notifySuccess("Reminder settings saved");
        onSaved();
      })
      .catch((err) => {
        setSaving(false);
        notifyError(err, "Could not save the settings.");
      });
  };

  return (
    <div className="space-y-4">
      <Section title="General">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.enabled} onCheckedChange={(enabled) => patch({ enabled })} />
          Send automated reminders
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="set-tz" label="Timezone">
            <NativeSelect id="set-tz" className="w-full" value={form.timezone} onChange={(e) => patch({ timezone: e.target.value })}>
              {TIMEZONES.map((tz) => (
                <NativeSelectOption key={tz} value={tz}>
                  {tz}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="set-time" label="Default send time" hint="Used by new rules.">
            <Input id="set-time" type="time" value={form.default_send_time} onChange={(e) => patch({ default_send_time: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.channels.sms} onCheckedChange={(sms) => patch({ channels: { ...form.channels, sms } })} />
            SMS
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.channels.email} onCheckedChange={(email) => patch({ channels: { ...form.channels, email } })} />
            Email
          </label>
        </div>
      </Section>

      <Section
        title="Contact hours"
        description={`Reminders only go out inside this window, and never before ${formatSendTime(CONTACT_HOURS_LIMIT.start)} or after ${formatSendTime(CONTACT_HOURS_LIMIT.end)}. One queued outside it waits for the next opening.`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="set-start" label="From">
            <Input
              id="set-start"
              type="time"
              min={CONTACT_HOURS_LIMIT.start}
              max={CONTACT_HOURS_LIMIT.end}
              value={form.contact_hours.start}
              onChange={(e) => patch({ contact_hours: { ...form.contact_hours, start: e.target.value } })}
            />
          </Field>
          <Field id="set-end" label="Until">
            <Input
              id="set-end"
              type="time"
              min={CONTACT_HOURS_LIMIT.start}
              max={CONTACT_HOURS_LIMIT.end}
              value={form.contact_hours.end}
              onChange={(e) => patch({ contact_hours: { ...form.contact_hours, end: e.target.value } })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Retries" description="Failed sends are retried; an invalid number or a bounced address is not.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="set-attempts" label={`Retry attempts (max ${MAX_RETRY_ATTEMPTS})`}>
            <Input
              id="set-attempts"
              type="number"
              min={0}
              max={MAX_RETRY_ATTEMPTS}
              value={form.retry.max_attempts}
              onChange={(e) => patch({ retry: { ...form.retry, max_attempts: e.target.valueAsNumber } })}
            />
          </Field>
          <Field id="set-delay" label="Wait between attempts (minutes)">
            <Input
              id="set-delay"
              type="number"
              min={1}
              value={form.retry.delay_minutes}
              onChange={(e) => patch({ retry: { ...form.retry, delay_minutes: e.target.valueAsNumber } })}
            />
          </Field>
        </div>
      </Section>

      <Section title="SMS provider" description="The API credentials are stored encrypted and never shown again.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sms-provider" label="Provider">
            <NativeSelect
              id="sms-provider"
              className="w-full"
              value={form.sms_provider.provider ?? ""}
              onChange={(e) => patchSms({ provider: (e.target.value || null) as SmsProvider | null })}
            >
              <NativeSelectOption value="">Not configured</NativeSelectOption>
              {SMS_PROVIDERS.map((p) => (
                <NativeSelectOption key={p.value} value={p.value}>
                  {p.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="sms-sender" label="Sender ID" hint="The name borrowers see, as registered with the provider.">
            <Input id="sms-sender" value={form.sms_provider.sender_id} onChange={(e) => patchSms({ sender_id: e.target.value })} />
          </Field>
          <Field id="sms-key" label="API key" hint={secretHint(settings.sms_provider.has_credentials)}>
            <Input
              id="sms-key"
              type="password"
              autoComplete="new-password"
              value={form.sms_provider.api_key ?? ""}
              onChange={(e) => patchSms({ api_key: e.target.value })}
            />
          </Field>
          <Field id="sms-secret" label="API secret" hint="Only if the provider uses one.">
            <Input
              id="sms-secret"
              type="password"
              autoComplete="new-password"
              value={form.sms_provider.api_secret ?? ""}
              onChange={(e) => patchSms({ api_secret: e.target.value })}
            />
          </Field>
          <Field id="sms-cost" label="Cost per SMS part (₱)" hint="Used for the dashboard's monthly estimate.">
            <Input
              id="sms-cost"
              type="number"
              min={0}
              step="0.01"
              value={form.sms_provider.cost_per_segment ?? ""}
              onChange={(e) => patchSms({ cost_per_segment: Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Email provider">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="email-provider" label="Provider">
            <NativeSelect
              id="email-provider"
              className="w-full"
              value={form.email_provider.provider ?? ""}
              onChange={(e) => patchEmail({ provider: (e.target.value || null) as EmailProvider | null })}
            >
              <NativeSelectOption value="">Not configured</NativeSelectOption>
              {EMAIL_PROVIDERS.map((p) => (
                <NativeSelectOption key={p.value} value={p.value}>
                  {p.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="email-key" label="API key / password" hint={secretHint(settings.email_provider.has_credentials)}>
            <Input
              id="email-key"
              type="password"
              autoComplete="new-password"
              value={form.email_provider.api_key ?? ""}
              onChange={(e) => patchEmail({ api_key: e.target.value })}
            />
          </Field>
          <Field id="email-name" label="Sender name">
            <Input id="email-name" value={form.email_provider.sender_name} onChange={(e) => patchEmail({ sender_name: e.target.value })} />
          </Field>
          <Field id="email-from" label="Sender email">
            <Input id="email-from" type="email" value={form.email_provider.sender_email} onChange={(e) => patchEmail({ sender_email: e.target.value })} />
          </Field>
          <Field id="email-reply" label="Reply-to (optional)">
            <Input
              id="email-reply"
              type="email"
              value={form.email_provider.reply_to ?? ""}
              onChange={(e) => patchEmail({ reply_to: e.target.value || null })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Payment instructions" description="Inserted wherever a template uses the payment instructions variable.">
        <Textarea
          aria-label="Payment instructions"
          rows={3}
          value={form.payment_instructions}
          onChange={(e) => patch({ payment_instructions: e.target.value })}
        />
      </Section>

      {form.branches.length > 0 && (
        <Section title="Branches" description="A branch can sign reminders with its own name and contact details.">
          <div className="space-y-3">
            {form.branches.map((b) => (
              <div key={b.branch_id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{b.branch_name}</p>
                  <NativeSelect
                    aria-label={`${b.branch_name} configuration`}
                    value={b.use_company_default ? "default" : "branch"}
                    onChange={(e) => patchBranch(b.branch_id, { use_company_default: e.target.value === "default" })}
                  >
                    <NativeSelectOption value="default">Use company default</NativeSelectOption>
                    <NativeSelectOption value="branch">Use branch configuration</NativeSelectOption>
                  </NativeSelect>
                </div>
                {!b.use_company_default && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      aria-label="Sender name"
                      placeholder="Sender name"
                      value={b.sender_name ?? ""}
                      onChange={(e) => patchBranch(b.branch_id, { sender_name: e.target.value || null })}
                    />
                    <Input
                      aria-label="Contact phone"
                      placeholder="Contact phone"
                      value={b.contact_phone ?? ""}
                      onChange={(e) => patchBranch(b.branch_id, { contact_phone: e.target.value || null })}
                    />
                    <Input
                      aria-label="Contact email"
                      placeholder="Contact email"
                      type="email"
                      value={b.contact_email ?? ""}
                      onChange={(e) => patchBranch(b.branch_id, { contact_email: e.target.value || null })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
