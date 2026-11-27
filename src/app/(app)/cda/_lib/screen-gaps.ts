import type {
  CdaDocument,
  CdaEvidence,
  CdaField,
  CdaOfficer,
  CdaReport,
  CdaReportRow,
  CdaSection,
  CdaSnapshotCheck,
  CdaSnapshotSummary,
} from "@/types/cda";
import type { Permission } from "@/types/rbac";
import { DOCUMENT_CATEGORY_LABELS, OFFICER_STATUS_LABELS, labelOf, type Tone } from "./labels";
import type { FieldDrafts } from "./report-fields";
import type { RecordDraft, RecordValue } from "./record-form";

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
  /** GET /cda/periods/{year}/documents, the documents register's list: the evidence picker's documents. */
  evidenceDocuments: "cda:view",
  /** POST /cda/periods/{year}/documents, the documents register's Upload: Upload and link. */
  evidenceUpload: "cda:upload",
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

// ── Evidence documents (a Compliance Document linked by id) ──

/** What the evidence picker reads of a Compliance Document. */
export type EvidenceDocument = Pick<CdaDocument, "id" | "title" | "category" | "category_label" | "status">;

const withdrawnNote = (d: EvidenceDocument) => (d.status === "withdrawn" ? " (withdrawn)" : "");

/**
 * Whether the report's evidence needs the year's documents: where staff can
 * link one, and to name the ones already linked. Otherwise nothing is read.
 */
export function evidenceDocumentsNeeded(sections: CdaSection[], canEdit: boolean): boolean {
  return sections.some(
    (section) =>
      section.kind === "fields" &&
      section.fields.some(
        (field) =>
          (canEdit && evidenceEditable(field)) || (field.evidence ?? []).some((entry) => typeof entry.document_id === "number"),
      ),
  );
}

/**
 * The picker's documents: the year's active ones, by title and category. An
 * entry's own link is never dropped: withdrawn since, it says so; outside the
 * list (another year's, or one the list leaves out), it reads in words, as it
 * does while the list loads (`documents` null). Never an id.
 */
export function evidenceDocumentOptions(
  documents: readonly EvidenceDocument[] | null,
  linkedId: number | null | undefined,
): { value: string; label: string }[] {
  const options = (documents ?? [])
    .filter((d) => d.status === "active" || d.id === linkedId)
    .map((d) => ({ value: String(d.id), label: evidenceDocumentLabel(d) }));
  if (typeof linkedId === "number" && !options.some((o) => o.value === String(linkedId))) {
    options.push({
      value: String(linkedId),
      label: documents === null ? "A filed document" : "A filed document (not in this year's list)",
    });
  }
  return options;
}

/** A document by title and category, saying when it has been withdrawn. */
function evidenceDocumentLabel(d: EvidenceDocument): string {
  return `${d.title} · ${d.category_label || labelOf(DOCUMENT_CATEGORY_LABELS, d.category)}${withdrawnNote(d)}`;
}

/**
 * The linked document in full, for the line under the picker: a native select
 * cuts a long title and category off. Null with no link, or when the list
 * doesn't name it (loading, or outside the year's list: the select says so).
 */
export function evidenceLinkedCaption(
  documents: readonly EvidenceDocument[] | null,
  linkedId: number | null | undefined,
): string | null {
  if (typeof linkedId !== "number") return null;
  const linked = documents?.find((d) => d.id === linkedId);
  return linked ? evidenceDocumentLabel(linked) : null;
}

/**
 * The year's documents with those uploaded here since the list was read, as
 * the upload answered them, so a new one is offered by title at once. The
 * server's own row wins once its list holds it.
 */
export function withUploaded<T extends { id: number }>(listed: readonly T[], uploaded: readonly T[]): T[] {
  return [...listed, ...uploaded.filter((u) => !listed.some((d) => d.id === u.id))];
}

/** The picked document's id as the API takes it; "No document linked" is null. */
export function documentIdOf(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** The evidence with one entry's document linked (null unlinks it); its typed reference and note stay. */
export function linkEvidence(evidence: CdaEvidence[], index: number, documentId: number | null): CdaEvidence[] {
  return evidence.map((entry, i) => (i === index ? { ...entry, document_id: documentId } : entry));
}

/**
 * Upload and link's starting values: the report the evidence is for (which
 * also keeps a restricted report's papers restricted) and the entry's typed
 * reference as the title. The category is left to staff: the report's own
 * category would let any piece of evidence settle the report's required
 * document (a performance audit's signed report).
 */
export function evidenceUploadDefaults(report: Pick<CdaReport, "id">, entry: CdaEvidence): RecordDraft {
  return { title: (entry.label ?? "").trim(), report_id: String(report.id) };
}

/**
 * One piece of evidence in words, for the read-only list: its reference, its
 * note, and the document it links by title ("A filed document" while the
 * year's documents load, or when the list doesn't hold it).
 */
export function evidenceWords(entry: CdaEvidence, documents: readonly EvidenceDocument[] | null): string {
  const label = blankToNull(entry.label);
  const note = blankToNull(entry.note);
  const documentId = entry.document_id ?? null;
  const linked = documentId === null ? undefined : (documents ?? []).find((d) => d.id === documentId);
  const title = linked ? `${linked.title}${withdrawnNote(linked)}` : null;
  const parts = [label ?? title ?? (documentId === null ? "Evidence" : "A filed document")];
  if (note !== null) parts.push(note);
  if (label !== null && documentId !== null) parts.push(title ? `linked to ${title}` : "linked to a filed document");
  return parts.join(" · ");
}

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
