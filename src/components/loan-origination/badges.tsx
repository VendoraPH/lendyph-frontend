import { cn } from "@/lib/utils";
import {
  ASSESSMENT_SHORT_LABELS,
  ASSESSMENT_TONES,
  BORROWER_STATUS_LABELS,
  BORROWER_STATUS_TONES,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  STATUS_LABELS,
  STATUS_TONES,
  TONE_CLASSES,
  type Tone,
} from "@/lib/loan-origination";
import type {
  ApplicationStatus,
  AssessmentResult,
  BorrowerFacingStatus,
  DocumentStatus,
} from "@/types/loan-origination";

/** A coloured status pill. Colour is never the only signal: it always carries words. */
export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** `label` is the server's `status_label` where it sends one. */
export function ApplicationStatusBadge({ status, label }: { status: ApplicationStatus; label?: string }) {
  return <ToneBadge tone={STATUS_TONES[status] ?? "neutral"}>{label || STATUS_LABELS[status] || status}</ToneBadge>;
}

export function ApplicantStatusBadge({ status }: { status: BorrowerFacingStatus }) {
  return <ToneBadge tone={BORROWER_STATUS_TONES[status]}>{BORROWER_STATUS_LABELS[status]}</ToneBadge>;
}

/** `label` is the server's `result_label` where it sends one. */
export function AssessmentBadge({ result, label }: { result: AssessmentResult | null; label?: string }) {
  if (!result) return <span className="text-sm text-muted-foreground">Not assessed</span>;
  return <ToneBadge tone={ASSESSMENT_TONES[result] ?? "neutral"}>{label || ASSESSMENT_SHORT_LABELS[result] || result}</ToneBadge>;
}

/** `label` is the server's `status_label` where it sends one. */
export function DocumentStatusBadge({ status, label }: { status: DocumentStatus; label?: string }) {
  return <ToneBadge tone={DOCUMENT_STATUS_TONES[status] ?? "neutral"}>{label || DOCUMENT_STATUS_LABELS[status] || status}</ToneBadge>;
}

/** An application or link marked as a test: kept out of the dashboard. */
export function TestBadge() {
  return <ToneBadge tone="neutral">Test</ToneBadge>;
}
