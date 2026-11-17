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

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <ToneBadge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</ToneBadge>;
}

export function ApplicantStatusBadge({ status }: { status: BorrowerFacingStatus }) {
  return <ToneBadge tone={BORROWER_STATUS_TONES[status]}>{BORROWER_STATUS_LABELS[status]}</ToneBadge>;
}

export function AssessmentBadge({ result }: { result: AssessmentResult | null }) {
  if (!result) return <span className="text-sm text-muted-foreground">Not assessed</span>;
  return <ToneBadge tone={ASSESSMENT_TONES[result]}>{ASSESSMENT_SHORT_LABELS[result]}</ToneBadge>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <ToneBadge tone={DOCUMENT_STATUS_TONES[status]}>{DOCUMENT_STATUS_LABELS[status]}</ToneBadge>;
}
