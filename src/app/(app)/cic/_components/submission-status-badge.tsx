import { Badge } from "@/components/ui/badge";
import type { CicSubmissionStatus } from "@/types/cic";

export const CIC_STATUS_LABELS: Record<CicSubmissionStatus, string> = {
  generated: "Generated",
  encrypted: "Encrypted",
  submitted: "Submitted",
  accepted: "Accepted by CIC",
  rejected: "Rejected by CIC",
};

const VARIANT: Record<CicSubmissionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  generated: "outline",
  encrypted: "secondary",
  submitted: "secondary",
  accepted: "default",
  rejected: "destructive",
};

export function SubmissionStatusBadge({ status }: { status: CicSubmissionStatus }) {
  return <Badge variant={VARIANT[status]}>{CIC_STATUS_LABELS[status]}</Badge>;
}

export function submissionTypeLabel(type: 0 | 1): string {
  return type === 1 ? "Correction" : "Regular";
}

/** Statuses CIC has seen, so a correction file (submission type 1) can answer them. */
export const CORRECTABLE_STATUSES: ReadonlySet<CicSubmissionStatus> = new Set(["submitted", "accepted", "rejected"]);
