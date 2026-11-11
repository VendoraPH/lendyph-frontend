import type {
  CdaEvidence,
  CdaField,
  CdaOfficer,
  CdaReport,
  CdaReportRow,
  CdaSnapshotCheck,
  CdaSnapshotSummary,
} from "@/types/cda";
import type { Permission } from "@/types/rbac";
import { OFFICER_STATUS_LABELS, labelOf, type Tone } from "./labels";
import type { FieldDrafts } from "./report-fields";
import type { RecordValue } from "./record-form";

/**
 * The CDA screens that came after v1 (f-followups "CDA screens follow-ups"):
 * a report's own deadline, its snapshot history and checksum check, field
 * evidence, and the officer pickers on social programs and the profile. Each
 * action shows for the permission its backend route needs; the server's
 * deadline, checksum and words are shown as sent.
 */
export const GAP_PERMISSIONS = {
  /** PATCH /cda/reports/{id}/deadline (UpdateCdaReportDeadlineRequest). */
  deadline: "cda:settings",
  /** GET …/snapshots, …/snapshots/{version} and POST …/verify (CdaSnapshotController). */
  snapshots: "cda:view",
  /** PUT /cda/reports/{id} (UpdateCdaReportRequest). */
  evidence: "cda:prepare",
  /** POST and PUT social programs (CdaSocialProgramRequest). */
  responsibleOfficer: "cda:manage_social",
  /** PUT /cda/regulatory-profile (UpdateCdaRegulatoryProfileRequest). */
  authorisedRep: "cda:settings",
} as const satisfies Record<string, Permission>;

export type GapAction = keyof typeof GAP_PERMISSIONS;

/** Whether a user holding `can` sees the action. */
export function showsFor(action: GapAction, can: (permission: Permission) => boolean): boolean {
  return can(GAP_PERMISSIONS[action]);
}

// ── A report's own deadline ──

export type DeadlineRequest =
  | { body: { override_on: string | null; reference: string | null } }
  | { missing: string[] };

/** The PATCH body, or what still needs filling. `null` removes the override. */
export function deadlineRequest(date: string | null, reference: string): DeadlineRequest {
  if (date === null) return { body: { override_on: null, reference: null } };
  const missing: string[] = [];
  if (!date.trim()) missing.push("New deadline");
  if (!reference.trim()) missing.push("Reference");
  if (missing.length > 0) return { missing };
  return { body: { override_on: date.trim(), reference: reference.trim() } };
}

/** The report with the server's deadline fields from the PATCH answer; nothing is worked out here. */
export function withDeadline(report: CdaReport, row: CdaReportRow): CdaReport {
  return {
    ...report,
    default_due_on: row.default_due_on,
    due_override_on: row.due_override_on,
    due_override_reference: row.due_override_reference,
    effective_deadline: row.effective_deadline,
    days_remaining: row.days_remaining,
  };
}

// ── Snapshot history ──

export function snapshotStatus(snapshot: Pick<CdaSnapshotSummary, "superseded_at">): { label: string; tone: Tone } {
  return snapshot.superseded_at ? { label: "Superseded", tone: "neutral" } : { label: "Current", tone: "success" };
}

/** The server's check, in words. */
export function checkWords(check: CdaSnapshotCheck): { label: string; tone: Tone; detail: string } {
  return check.checksum_matches
    ? { label: "Checksum matches", tone: "success", detail: `Version ${check.version} is exactly as it was finalized.` }
    : {
        label: "Checksum doesn't match",
        tone: "danger",
        detail: `Version ${check.version} doesn't match the checksum recorded when it was finalized. Tell your administrator.`,
      };
}

// ── Field evidence ──

/**
 * Whether a field takes evidence: the same fields that take remarks (a value
 * staff type, a figure they may override, or one already overridden). A fixed
 * figure from the system stays read-only.
 */
export function evidenceEditable(field: Pick<CdaField, "editable" | "overridable" | "overridden">): boolean {
  return field.editable || field.overridable || field.overridden;
}

/** The evidence a field shows: the unsaved list when there is one. */
export function currentEvidence(field: CdaField, drafts: FieldDrafts): CdaEvidence[] {
  const draft = drafts[field.field_key];
  if (draft && "evidence" in draft) return draft.evidence ?? [];
  return field.evidence ?? [];
}

const blankToNull = (text: string | null | undefined): string | null => {
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** What the PUT sends: trimmed entries, blank ones dropped, a linked document kept; none is null. */
export function cleanEvidence(entries: CdaEvidence[]): CdaEvidence[] | null {
  const kept: CdaEvidence[] = [];
  for (const entry of entries) {
    const label = blankToNull(entry.label);
    const note = blankToNull(entry.note);
    const documentId = entry.document_id ?? null;
    if (label === null && note === null && documentId === null) continue;
    kept.push(documentId === null ? { label, note } : { document_id: documentId, label, note });
  }
  return kept.length > 0 ? kept : null;
}

/** The server allows 20 pieces of evidence per field. */
export const EVIDENCE_LIMIT = 20;

// ── Officer pickers ──

type OfficerChoice = Pick<CdaOfficer, "id" | "name" | "position_label" | "position_title" | "status">;

/**
 * The officers register as choices: name and position (a former officer says
 * so). An officer already chosen but not in the list is kept, by the name the
 * server sent and `note`, so opening a record never drops its pick.
 */
export function officerOptions(
  officers: OfficerChoice[],
  chosen: { id: number; name: string | null }[] = [],
  note = "not serving this year",
): { value: string; label: string }[] {
  const options = officers.map((o) => {
    const position = o.position_title || o.position_label;
    const former = o.status && o.status !== "active" ? ` (${labelOf(OFFICER_STATUS_LABELS, o.status)})` : "";
    return { value: String(o.id), label: `${o.name ?? "Unnamed officer"} · ${position}${former}` };
  });
  for (const pick of chosen) {
    if (options.some((o) => o.value === String(pick.id))) continue;
    options.push({ value: String(pick.id), label: `${pick.name ?? "The officer on file"} (${note})` });
  }
  return options;
}

/** A picked officer's id as the API takes it; blank is null. */
export function officerIdOf(raw: RecordValue | undefined): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  return Number(raw.trim());
}
