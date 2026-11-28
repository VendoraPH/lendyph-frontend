// The CIC screens' words for the server's fixed values. Pure, so they are
// unit-tested; every figure on these screens comes from the server.
import { formatDate } from "@/lib/format";
import type {
  CicCapture,
  CicCaptureKind,
  CicClassification,
  CicDataRecordType,
  CicIssueRecordType,
  CicKeyStatus,
  CicSeverity,
  CicStaff,
} from "@/types/cic";

export const RECORD_TYPE_LABELS: Record<CicIssueRecordType, string> = {
  ID: "Individual",
  CI: "Installment contract",
  CN: "Non-installment contract",
  NE: "Negative event",
  HD: "File header",
  FT: "File footer",
};

/** "CI · Installment contract". */
export function recordTypeLabel(type: CicIssueRecordType): string {
  return `${type} · ${RECORD_TYPE_LABELS[type]}`;
}

export const SUBJECT_RECORD_TYPES: readonly CicDataRecordType[] = ["ID", "NE"];
export const CONTRACT_RECORD_TYPES: readonly CicDataRecordType[] = ["CI", "CN"];

export const SEVERITY_LABELS: Record<CicSeverity, string> = { error: "Error", warning: "Warning" };

export const CLASSIFICATION_LABELS: Record<CicClassification, string> = {
  M: "Mandatory",
  D: "Dependent",
  NM: "Not mandatory",
};

export const CAPTURE_KIND_LABELS: Record<CicCaptureKind, string> = {
  month_end: "Month-end",
  test: "Test",
  correction: "Correction",
};

export const KEY_STATUS_LABELS: Record<CicKeyStatus, string> = {
  pending: "Waiting for verification",
  active: "Active",
  retired: "Retired",
};

/** "Month-end capture of Oct 31, 2026 (#12)". */
export function captureLabel(c: Pick<CicCapture, "id" | "kind" | "reference_date">): string {
  return `${CAPTURE_KIND_LABELS[c.kind]} capture of ${formatDate(c.reference_date)} (#${c.id})`;
}

/**
 * The captures a standard file can be generated from: complete month-end
 * captures, and complete test captures while the server allows them (staging).
 * Correction captures make correction files only.
 */
export function fileCaptures<T extends Pick<CicCapture, "kind" | "status">>(captures: readonly T[], testCaptures: boolean): T[] {
  return captures.filter(
    (c) => c.status === "complete" && (c.kind === "month_end" || (testCaptures && c.kind === "test")),
  );
}

/** A staff member's name, or what to say when the server names nobody. */
export function staffName(staff: CicStaff | null, nobody = "—"): string {
  return staff?.name ?? (staff ? `User #${staff.id}` : nobody);
}

/** "Oct 31, 2026 by Ana Cruz", or a dash before it happened. */
export function whenBy(at: string | null, by: CicStaff | null, format: (iso: string) => string): string {
  if (!at) return "—";
  return by ? `${format(at)} by ${staffName(by)}` : format(at);
}
