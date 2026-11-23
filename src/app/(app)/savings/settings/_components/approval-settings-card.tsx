"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { usePermission } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsSettings } from "@/types";
import { ActionButton } from "../../_components/action-button";
import { FormField } from "../../_components/field";
import { readSettingsDraft, settingsEditBlocker, toSettingsDraft, type SettingsDraft } from "../_lib/settings-form";

interface ApprovalSettingsCardProps {
  settings: SavingsSettings;
  onSaved: () => void;
}

export function ApprovalSettingsCard({ settings, onSaved }: ApprovalSettingsCardProps) {
  // Company-wide: read-only, with the reason, without savings:settings and branches:view_all.
  const blocker = settingsEditBlocker(usePermission().can);
  const canEdit = blocker === null;
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

  const field = (key: Exclude<keyof SettingsDraft, "checkers">, id: string, label: string, hint: string, numeric = false) => (
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
        <CardTitle className="text-base">Approvals, dormancy and notices</CardTitle>
        <CardDescription>
          A withdrawal, closing payout or time deposit payout up to the first amount posts at once. Above it, another
          user approves; above the second, that many different approvers do. Maturity notices and the dormancy warning
          go to staff and the member in the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("tier1", "ss-tier1", "Approval needed above (₱)", "One approver.")}
          {field("tier2", "ss-tier2", "Two approvers needed above (₱)", "More than the first amount.")}
          <FormField id="ss-checkers" label="Approvers above the second amount" hint="Two different users (dual control).">
            <Input id="ss-checkers" value={draft.checkers} readOnly disabled />
          </FormField>
          {field("dormancy", "ss-dormancy", "Dormant after (months)", "With no deposit, withdrawal or transfer.", true)}
          {field("alert", "ss-alert", "Large transaction alert (₱)", "Transactions at or above this are flagged.")}
          <FormField
            id="ss-notice-days"
            label="Maturity notices (days before)"
            hint="Commas between days; 0 is the maturity day. Up to 10, or blank for none."
          >
            <Input
              id="ss-notice-days"
              placeholder="30, 15, 7, 3, 0"
              value={draft.noticeDays}
              onChange={set("noticeDays")}
              disabled={!canEdit}
            />
          </FormField>
          {field(
            "warningDays",
            "ss-warning-days",
            "Dormancy warning (days before)",
            "Staff and the member are warned this many days before an account turns dormant. 0 to 365.",
            true,
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
          <ActionButton permission="savings:settings" onClick={save} disabled={submitting} blockedReason={blocker}>
            {submitting ? "Saving…" : "Save settings"}
          </ActionButton>
        </div>
      </CardContent>
    </Card>
  );
}
