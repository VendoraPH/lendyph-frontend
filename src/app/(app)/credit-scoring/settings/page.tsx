"use client";

import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import { fieldErrorsFor } from "@/lib/credit-scoring/field-errors";
import {
  POLICY_FIGURES,
  settingsBody,
  settingsFormFrom,
  type PolicyFigureKey,
  type SettingsForm,
} from "@/lib/credit-scoring/settings-form";
import { CreditScoringPageHeader } from "../_components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CreditScoringSettings } from "@/types/credit-scoring";

type FieldKey = PolicyFigureKey | "privacy_notice";
type Errors = Partial<Record<FieldKey, string[]>>;

const FIELD_KEYS: FieldKey[] = ["privacy_notice", ...POLICY_FIGURES.map((f) => f.key)];

function errorsOf(err: unknown): Errors {
  const out: Errors = {};
  for (const key of FIELD_KEYS) {
    const messages = fieldErrorsFor(err, key);
    if (messages.length > 0) out[key] = messages;
  }
  return out;
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {messages.join(" ")}
    </p>
  );
}

function SettingsBody({
  settings,
  form,
  errors,
  onChange,
}: {
  settings: CreditScoringSettings;
  form: SettingsForm;
  errors: Errors;
  onChange: (key: FieldKey, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="privacy-notice" className="sr-only">
            Privacy notice
          </Label>
          <Textarea
            id="privacy-notice"
            value={form.privacy_notice}
            onChange={(e) => onChange("privacy_notice", e.target.value)}
            className="min-h-32"
            aria-invalid={errors.privacy_notice ? true : undefined}
            aria-describedby={errors.privacy_notice ? "privacy-notice-error" : undefined}
          />
          <FieldError id="privacy-notice-error" messages={errors.privacy_notice} />
          <p className="text-xs text-muted-foreground">
            Notice version {settings.notice_version ?? "—"}. Changing the text starts a new version, and each loan
            application records the version the member acknowledged.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy Figures</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {POLICY_FIGURES.map((f) => {
            const id = `policy-${f.key}`;
            const errorId = `${id}-error`;
            const hintId = `${id}-hint`;
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    className="w-32 text-right tabular-nums"
                    value={form[f.key]}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    aria-invalid={errors[f.key] ? true : undefined}
                    aria-describedby={errors[f.key] ? `${hintId} ${errorId}` : hintId}
                  />
                  <span className="text-sm text-muted-foreground">{f.unit}</span>
                </div>
                <p id={hintId} className="text-xs text-muted-foreground">
                  {f.hint}
                </p>
                <FieldError id={errorId} messages={errors[f.key]} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scorecard Version</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <span className="font-medium">v{settings.score_model_version}</span>
          <p className="text-muted-foreground">
            Read only. Each score is stamped with the scorecard version it was worked out with. Saving the Scorecard
            Configuration makes a new version.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confidence Definitions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settings.confidence_definitions.map((def) => (
            <div key={def.level} className="text-sm">
              <span className="font-medium">{def.label}</span>
              <p className="text-muted-foreground">{def.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flag Definitions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settings.hard_flag_definitions.map((def) => (
            <div key={def.type} className="text-sm">
              <span className="font-medium">{def.label}</span>
              <p className="text-muted-foreground">{def.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CreditScoringSettingsContent() {
  const fetcher = useCallback(() => creditScoringService.getSettings(), []);
  const resource = useApiResource<CreditScoringSettings>(fetcher);
  const [draft, setDraft] = useState<SettingsForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function handleSave(form: SettingsForm) {
    setSaving(true);
    setErrors({});
    try {
      await creditScoringService.updateSettings(settingsBody(form));
      notifySuccess("Settings saved.");
      setDraft(null);
      resource.refetch();
    } catch (err: unknown) {
      setErrors(errorsOf(err));
      notifyError(err, "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Settings"
        description="The privacy notice, the policy figures behind capacity and flags, and the definitions shown to staff."
      />

      <DataState
        resource={resource}
        summary="Credit scoring settings: the privacy notice, the policy figures and the definitions."
        endpoints={["GET /credit-scoring/settings", "PUT /credit-scoring/settings"]}
      >
        {(settings) => {
          const form = draft ?? settingsFormFrom(settings);
          return (
            <div className="space-y-6">
              <SettingsBody
                settings={settings}
                form={form}
                errors={errors}
                onChange={(key, value) => setDraft({ ...form, [key]: value })}
              />
              <Button onClick={() => handleSave(form)} disabled={saving}>
                {saving ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          );
        }}
      </DataState>
    </div>
  );
}

export default function CreditScoringSettingsPage() {
  return (
    <RouteGuard permission="credit_scoring:settings" pageName="Credit Scoring Settings">
      <CreditScoringSettingsContent />
    </RouteGuard>
  );
}
