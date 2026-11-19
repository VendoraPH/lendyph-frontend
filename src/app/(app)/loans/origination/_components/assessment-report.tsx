"use client";

import { AlertTriangle, Info } from "lucide-react";
import { AssessmentBadge, ToneBadge } from "@/components/loan-origination/badges";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { TONE_CLASSES, ratioTone, type Tone } from "@/lib/loan-origination";
import { cn } from "@/lib/utils";
import type { Assessment, AssessmentFigures } from "@/types/loan-origination";

const MONEY_ROWS: { key: keyof AssessmentFigures; label: string }[] = [
  { key: "declared_monthly_income", label: "Declared monthly income" },
  { key: "verified_monthly_income", label: "Verified monthly income" },
  { key: "eligible_monthly_income", label: "Eligible monthly income" },
  { key: "monthly_expenses", label: "Monthly expenses" },
  { key: "monthly_debt_payments", label: "Existing monthly debt payments" },
  { key: "disposable_income", label: "Disposable income" },
  { key: "proposed_monthly_installment", label: "Proposed monthly installment" },
];

const money = (v: number | null) => (v === null ? "—" : formatCurrency(v));
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 10) / 10}%`);

function Ratio({ label, value, display, limit, tone }: { label: string; value: string; display: string; limit: string; tone: Tone }) {
  return (
    <div className={cn("rounded-lg p-3", TONE_CLASSES[tone])}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{display}</p>
      <p className="text-xs opacity-80">
        {value} {limit}
      </p>
    </div>
  );
}

function Flags({ title, items, tone }: { title: string; items: string[]; tone: Tone }) {
  if (items.length === 0) return null;
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <div className={cn("rounded-lg p-3 text-sm", TONE_CLASSES[tone])}>
      <p className="mb-1 flex items-center gap-1.5 font-medium">
        <Icon className="h-4 w-4" /> {title}
      </p>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The server's affordability assessment, shown as it was stored. It is a
 * guide for staff, never a decision: the figures, thresholds and wording
 * all come from the server's rules, so nothing is recomputed here.
 */
export function AssessmentReport({ assessment }: { assessment: Assessment }) {
  const { figures: f, thresholds: t } = assessment;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AssessmentBadge result={assessment.result} />
        {assessment.provisional && <ToneBadge tone="warning">Provisional</ToneBadge>}
        <span className="text-xs text-muted-foreground">
          Version {assessment.version} · {formatDateTime(assessment.assessed_at)} · rules {assessment.rules_version}
        </span>
      </div>

      <p className="text-sm">{assessment.explanation}</p>

      <div className="grid gap-2 sm:grid-cols-3">
        <Ratio
          label="Debt-to-income"
          display={pct(f.dti_ratio)}
          value="limit"
          limit={`${t.max_dti}%`}
          tone={ratioTone(f.dti_ratio, t.max_dti, "max")}
        />
        <Ratio
          label="Installment coverage"
          display={f.coverage_ratio === null ? "—" : `${Math.round(f.coverage_ratio * 100) / 100}×`}
          value="minimum"
          limit={`${t.min_coverage}×`}
          tone={ratioTone(f.coverage_ratio, t.min_coverage, "min")}
        />
        <Ratio
          label="Remaining income"
          display={money(f.remaining_income)}
          value="minimum"
          limit={formatCurrency(t.min_remaining_income)}
          tone={ratioTone(f.remaining_income, t.min_remaining_income, "min")}
        />
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {MONEY_ROWS.map((r) => (
          <div key={r.key} className="flex justify-between gap-3 border-b border-dashed py-1">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="tabular-nums">{money(f[r.key])}</dd>
          </div>
        ))}
      </dl>

      <Flags title="Missing or unverified information" items={assessment.missing_information} tone="warning" />
      <Flags title="Conflicting information" items={assessment.conflicts} tone="danger" />
      {assessment.document_status && (
        <p className="text-sm text-muted-foreground">Documents: {assessment.document_status}</p>
      )}
      <p className="text-xs text-muted-foreground">
        This assessment does not approve or reject the application. Final approval stays with the authorized loan
        approvers.
      </p>
    </div>
  );
}
