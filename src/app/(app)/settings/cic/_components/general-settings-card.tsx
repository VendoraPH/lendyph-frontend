"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cicService } from "@/services";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CicSettings, UpdateCicSettingsData } from "@/types/cic";
import { whenBy } from "@/app/(app)/cic/_lib/labels";

type Form = { [K in keyof UpdateCicSettingsData]: K extends "is_mfi" ? boolean : string };

const formOf = (s: CicSettings): Form => ({
  provider_code: s.provider_code ?? "",
  is_mfi: s.is_mfi,
  institution_name: s.institution_name ?? "",
  contact_name: s.contact_name ?? "",
  contact_email: s.contact_email ?? "",
  contact_phone: s.contact_phone ?? "",
});

const TEXT_FIELDS: { key: Exclude<keyof Form, "is_mfi" | "provider_code">; label: string; type?: string; max: number }[] = [
  { key: "institution_name", label: "Institution name", max: 160 },
  { key: "contact_name", label: "Contact person", max: 120 },
  { key: "contact_email", label: "Contact email", type: "email", max: 120 },
  { key: "contact_phone", label: "Contact phone", type: "tel", max: 40 },
];

/** The provider code, MFI status and the contact CIC writes to. The server checks every field. */
export function GeneralSettingsCard({ settings, onSaved }: { settings: CicSettings; onSaved: (s: CicSettings) => void }) {
  const [form, setForm] = useState<Form>(() => formOf(settings));
  const [saving, setSaving] = useState(false);
  const blankToNull = (v: string) => v.trim() || null;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await cicService.updateSettings({
        // CIC's codes are upper case; the server checks the rest.
        provider_code: blankToNull(form.provider_code)?.toUpperCase() ?? null,
        is_mfi: form.is_mfi,
        institution_name: blankToNull(form.institution_name),
        contact_name: blankToNull(form.contact_name),
        contact_email: blankToNull(form.contact_email),
        contact_phone: blankToNull(form.contact_phone),
      });
      setSaving(false);
      setForm(formOf(saved));
      notifySuccess("CIC settings saved.");
      onSaved(saved);
    } catch (err) {
      setSaving(false);
      notifyError(err, "CIC settings could not be saved.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Provider</CardTitle>
        <CardDescription>
          How CIC knows this lender. Every file&apos;s name and header carry the provider code.{" "}
          {settings.updated_at && `Last saved ${whenBy(settings.updated_at, settings.updated_by, formatDateTime)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cic-provider-code">Provider code</Label>
          <Input
            id="cic-provider-code"
            className="font-mono uppercase"
            maxLength={8}
            autoComplete="off"
            value={form.provider_code}
            onChange={(e) => setForm({ ...form, provider_code: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">The 8 letters or digits CIC assigned.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cic-format">File format</Label>
          <Input id="cic-format" readOnly value={`CSDF version ${settings.format_version}`} />
          <p className="text-xs text-muted-foreground">Fixed to CIC&apos;s 2016 layouts.</p>
        </div>
        <div className="flex items-start gap-3 pt-6">
          <Switch id="cic-is-mfi" checked={form.is_mfi} onCheckedChange={(is_mfi) => setForm({ ...form, is_mfi })} />
          <div className="space-y-0.5">
            <Label htmlFor="cic-is-mfi">Microfinance institution (MFI)</Label>
            <p className="text-xs text-muted-foreground">CIC asks MFIs for the address subdivision.</p>
          </div>
        </div>
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`cic-${f.key}`}>{f.label}</Label>
            <Input
              id={`cic-${f.key}`}
              type={f.type}
              maxLength={f.max}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div className="sm:col-span-2 xl:col-span-3">
          <Button disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
