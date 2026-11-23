"use client";

import { AlertTriangle, Info, Lock } from "lucide-react";
import { AssessmentBadge, ToneBadge } from "@/components/loan-origination/badges";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { TONE_CLASSES, inWords, type Tone } from "@/lib/loan-origination";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types/loan-origination";
import {
  FIGURE_ROWS,
  WITHHELD_SENTENCE,
  checkTone,
  checkWords,
  coverageText,
  dtiText,
  figureText,
  limitWords,
} from "../_lib/assessment-view";

function Limit({ label, display, limit, passed }: { label: string; display: string; limit: string; passed: boolean | null }) {
  return (
    <div className={cn("rounded-lg p-3", TONE_CLASSES[checkTone(passed)])}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{display}</p>
      <p className="text-xs opacity-80">
        {limit} · {checkWords(passed)}
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
 * The server's capacity assessment, shown as stored: its figures, its limits
 * with its own checks, and its explanation. The DTI and coverage read exactly
 * as sent. Figures that count a linked member's loans read "Withheld" for a
 * viewer the server withholds them from. A guide for staff, never a decision.
 */
export function AssessmentReport({ assessment: a }: { assessment: Assessment }) {
  const request: [string, string | null][] = [
    ["Amount requested", a.requested_amount === null ? null : formatCurrency(a.requested_amount)],
    ["Term", a.requested_term === null ? null : String(a.requested_term)],
    ["Payment schedule", inWords(a.frequency)],
    ["Loan start date", a.start_date ? formatDate(a.start_date) : null],
    ["Instalment taken as", a.instalment_basis],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AssessmentBadge result={a.result} label={a.result_label} />
        {a.provisional && <ToneBadge tone="warning">Provisional</ToneBadge>}
        {a.policy_exception && <ToneBadge tone="danger">Policy Exception chain</ToneBadge>}
        <span className="text-xs text-muted-foreground">
          Version {a.version}
          {a.assessed_at && <> · {formatDateTime(a.assessed_at)}</>}
          {a.assessed_by && <> · {a.assessed_by.name}</>} · rules revision {a.rules_version}
        </span>
      </div>

      <p className="text-sm">{a.explanation}</p>
      {a.member_figures_hidden && (
        <p className="flex items-start gap-1.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {WITHHELD_SENTENCE}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <Limit label="Debt-to-income ratio" display={dtiText(a)} limit={limitWords("dti", a.thresholds)} passed={a.checks.dti} />
        <Limit label="Coverage ratio" display={coverageText(a)} limit={limitWords("coverage", a.thresholds)} passed={a.checks.coverage} />
        <Limit
          label="Remaining income"
          display={figureText(a, "remaining_income")}
          limit={limitWords("remaining_income", a.thresholds)}
          passed={a.checks.remaining_income}
        />
      </div>

      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <dl className="text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Monthly figures</p>
          {FIGURE_ROWS.map((r) => (
            <div key={r.key} className="flex justify-between gap-3 border-b border-dashed py-1">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="tabular-nums">{figureText(a, r.key)}</dd>
            </div>
          ))}
        </dl>
        <dl className="text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Loan assessed</p>
          {request.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-dashed py-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Flags title="Missing or unverified information" items={a.missing_information} tone="warning" />
      <Flags title="Conflicting information" items={a.conflicts} tone="danger" />
      {a.document_status && <p className="text-sm text-muted-foreground">Documents: {a.document_status}</p>}
      <p className="text-xs text-muted-foreground">
        This assessment does not approve or reject the application. Final approval stays with the authorized loan
        approvers.
      </p>
    </div>
  );
}
