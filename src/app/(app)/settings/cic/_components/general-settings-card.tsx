"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cicService } from "@/services";
import { isValidProviderCode } from "@/lib/cic/validate";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CicSettings, UpdateCicSettingsData } from "@/types/cic";

/** Provider code, MFI status and the contact CIC writes to about a file. */
export function GeneralSettingsCard({
  settings,
  onSaved,
}: {
  settings: CicSettings;
  onSaved: (settings: CicSettings) => void;
}) {
  const [form, setForm] = useState<UpdateCicSettingsData>({
    provider_code: settings.provider_code ?? "",
    is_mfi: settings.is_mfi,
    contact_name: settings.contact_name ?? "",
    contact_email: settings.contact_email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const code = (form.provider_code ?? "").trim().toUpperCase();
  const codeInvalid = code !== "" && !isValidProviderCode(code);

  const save = async () => {
    if (!code || codeInvalid) {
      notifyValidation(["Provider code (exactly 8 letters or digits)"]);
      return;
    }
    setSaving(true);
    try {
      const saved = await cicService.updateSettings({
        provider_code: code,
        is_mfi: form.is_mfi,
        contact_name: form.contact_name?.trim() || null,
        contact_email: form.contact_email?.trim() || null,
      });
      setSaving(false);
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
        <CardDescription>How CIC knows this cooperative. Every file&apos;s header and name carry the code.</CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cic-provider-code">Provider code</Label>
          <Input
            id="cic-provider-code"
            className="font-mono uppercase"
            maxLength={8}
            value={form.provider_code ?? ""}
            aria-invalid={codeInvalid || undefined}
            onChange={(e) => setForm({ ...form, provider_code: e.target.value })}
          />
          <p className={codeInvalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            The 8 letters or digits CIC assigned.
          </p>
        </div>
        <div className="flex items-start gap-3 pt-6">
          <Switch
            id="cic-is-mfi"
            checked={form.is_mfi}
            onCheckedChange={(is_mfi) => setForm({ ...form, is_mfi })}
          />
          <div className="space-y-0.5">
            <Label htmlFor="cic-is-mfi">Microfinance institution (MFI)</Label>
            <p className="text-xs text-muted-foreground">
              CIC asks MFIs for the address subdivision and fewer contact fields.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cic-contact-name">Contact person</Label>
          <Input
            id="cic-contact-name"
            value={form.contact_name ?? ""}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cic-contact-email">Contact email</Label>
          <Input
            id="cic-contact-email"
            type="email"
            value={form.contact_email ?? ""}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
