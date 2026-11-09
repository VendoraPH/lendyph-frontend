"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { INCOME_VERIFICATION_LABELS } from "@/lib/credit-scoring/labels";
import {
  SAVE_BLOCKED_REASON,
  noticeStatus,
  type AssessmentForm,
  type AssessmentTextField,
} from "@/lib/credit-scoring/assessment-card";
import type { IncomeVerification, LoanCreditAssessment } from "@/types/credit-scoring";
import { DetailsHiddenNotice } from "./details-hidden-notice";

/** A Select can't hold an empty value, so "not given" has its own key. */
const NONE = "none";

const TEXT_FIELDS: { key: AssessmentTextField; label: string; mode: "decimal" | "numeric" | "date"; hint?: string }[] = [
  { key: "other_income", label: "Other monthly income (₱)", mode: "decimal" },
  { key: "business_income", label: "Monthly business income (₱)", mode: "decimal" },
  { key: "household_expenses", label: "Monthly household expenses (₱)", mode: "decimal" },
  { key: "outside_debt_payments", label: "Monthly payments to other lenders (₱)", mode: "decimal" },
  { key: "outside_lenders_count", label: "Other lenders", mode: "numeric" },
  { key: "verified_references_count", label: "Verified references", mode: "numeric" },
  { key: "years_at_residence", label: "Years at residence", mode: "decimal" },
  { key: "business_start_date", label: "Business start date", mode: "date" },
];

export function AssessmentFormFields({
  assessment,
  form,
  canSave,
  detailsHidden,
  saving,
  onChange,
  onSave,
}: {
  assessment: LoanCreditAssessment;
  form: AssessmentForm;
  canSave: boolean;
  /** The server doesn't send this caller the application details: none is shown or sent. */
  detailsHidden: boolean;
  saving: boolean;
  onChange: (next: AssessmentForm) => void;
  onSave: () => void;
}) {
  const employmentItems = [
    { value: NONE, label: "Not given" },
    ...assessment.employment_statuses.map((s) => ({ value: s.value, label: s.label })),
  ];
  const verificationItems = [
    { value: NONE, label: "Not checked" },
    ...(Object.keys(INCOME_VERIFICATION_LABELS) as IncomeVerification[]).map((v) => ({
      value: v,
      label: INCOME_VERIFICATION_LABELS[v],
    })),
  ];
  const notice = noticeStatus(assessment.application_profile);

  return (
    <section aria-labelledby="application-details-heading" className="space-y-4">
      <div>
        <h3 id="application-details-heading" className="text-sm font-medium">
          Application Details
        </h3>
        <p className="text-xs text-muted-foreground">
          Optional. Saving scores this application again. Leave a field empty to clear it.
        </p>
      </div>

      {detailsHidden ? (
        <DetailsHiddenNotice />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => {
            const id = `assessment-${f.key}`;
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                <Input
                  id={id}
                  type={f.mode === "date" ? "date" : "text"}
                  inputMode={f.mode === "date" ? undefined : f.mode}
                  className={f.mode === "date" ? undefined : "tabular-nums"}
                  value={form[f.key]}
                  disabled={!canSave}
                  onChange={(e) => onChange({ ...form, [f.key]: e.target.value })}
                />
              </div>
            );
          })}

          <div className="space-y-1.5">
            <Label id="assessment-employment-label">Employment status</Label>
            <Select
              value={form.employment_status || NONE}
              onValueChange={(v) => onChange({ ...form, employment_status: v && v !== NONE ? v : "" })}
              items={employmentItems}
              disabled={!canSave}
            >
              <SelectTrigger className="w-full" aria-labelledby="assessment-employment-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employmentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label id="assessment-income-label">Income verification</Label>
            <Select
              value={form.income_verification || NONE}
              onValueChange={(v) =>
                onChange({ ...form, income_verification: v && v !== NONE ? (v as IncomeVerification) : "" })
              }
              items={verificationItems}
              disabled={!canSave}
            >
              <SelectTrigger className="w-full" aria-labelledby="assessment-income-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {verificationItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium">Privacy notice (version {assessment.notice_version ?? "—"})</p>
        <p className="whitespace-pre-line text-sm text-muted-foreground">{assessment.privacy_notice}</p>
        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="assessment-notice"
            checked={form.notice_acknowledged}
            disabled={!canSave}
            onCheckedChange={(checked) => onChange({ ...form, notice_acknowledged: checked === true })}
          />
          <Label htmlFor="assessment-notice" className="text-sm font-normal leading-snug">
            The member has been given this notice and acknowledges it.
          </Label>
        </div>
        {notice.kind !== "none" && (
          <p className="text-xs text-muted-foreground">
            Acknowledged under v{notice.version} on {formatDateTime(notice.at)}
            {notice.kind === "earlier" ? ". Tick the box once the member acknowledges this version." : "."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSave} disabled={!canSave || saving} aria-describedby={canSave ? undefined : "assessment-save-reason"}>
          {saving ? "Saving…" : "Save and Assess"}
        </Button>
        {!canSave && (
          <p id="assessment-save-reason" className="text-xs text-muted-foreground">
            {SAVE_BLOCKED_REASON}
          </p>
        )}
      </div>
    </section>
  );
}
