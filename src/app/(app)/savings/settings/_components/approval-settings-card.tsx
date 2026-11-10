"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { usePermission } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsSettings } from "@/types";
import { FormField } from "../../_components/field";
import { readSettingsDraft, toSettingsDraft, type SettingsDraft } from "../_lib/settings-form";

interface ApprovalSettingsCardProps {
  settings: SavingsSettings;
  onSaved: () => void;
}

export function ApprovalSettingsCard({ settings, onSaved }: ApprovalSettingsCardProps) {
  const canEdit = usePermission().can("savings:settings");
  const [draft, setDraft] = useState<SettingsDraft>(() => toSettingsDraft(settings));
  const [source, setSource] = useState(settings);
  const { submitting, run } = useSubmitGuard();
  // A reload brings new server values; the form follows them.
  if (source !== settings) {
    setSource(settings);
    setDraft(toSettingsDraft(settings));
  }

  const set = (key: keyof SettingsDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  function save() {
    const { input, problems } = readSettingsDraft(draft);
    if (problems.length) return notifyValidation(problems);
    run(() => savingsService.updateSettings(input))
      ?.then(() => {
        notifySuccess("Savings settings saved");
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't save the savings settings."));
  }

  const field = (key: keyof SettingsDraft, id: string, label: string, hint: string, numeric = false) => (
    <FormField id={id} label={label} hint={hint}>
      <Input
        id={id}
        inputMode={numeric ? "numeric" : "decimal"}
        value={draft[key]}
        onChange={set(key)}
        disabled={!canEdit}
      />
    </FormField>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approvals and dormancy</CardTitle>
        <CardDescription>
          A withdrawal, closing payout or time deposit payout up to the first amount posts at once. Above it, another
          user approves; above the second, that many different approvers do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("tier1", "ss-tier1", "Approval needed above (₱)", "One approver.")}
          {field("tier2", "ss-tier2", "Two approvers needed above (₱)", "More than the first amount.")}
          {field("checkers", "ss-checkers", "Approvers above the second amount", "Different users; 2 or more.", true)}
          {field("dormancy", "ss-dormancy", "Dormant after (months)", "With no deposit, withdrawal or transfer.", true)}
          {field("alert", "ss-alert", "Large transaction alert (₱)", "Transactions at or above this are flagged.")}
        </div>
        <div className="flex justify-end">
          <PermissionButton permission="savings:settings" onClick={save} disabled={submitting}>
            {submitting ? "Saving…" : "Save settings"}
          </PermissionButton>
        </div>
      </CardContent>
    </Card>
  );
}
