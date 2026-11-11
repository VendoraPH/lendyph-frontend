import { formatDate } from "@/lib/format";
import type { CdaColumnFormat, CdaField, CdaFieldInput, CdaFieldValue, CdaIssue, CdaSection } from "@/types/cda";
import { COMPLIANCE_OPTIONS } from "./labels";
import { asSent, cdaMoney, cdaPercent } from "./money";

/**
 * Unsaved edits to a report, keyed by the field's `field_key`
 * ("membership.members_total"). A value is what staff typed, as text for
 * numbers and money; the server checks and stores it.
 */
export interface FieldDraft {
  value?: CdaFieldValue;
  remarks?: string | null;
  /** Needed when a figure from the system is overridden. */
  override_reason?: string | null;
  /** Go back to the system's figure. */
  revert?: boolean;
}

export type FieldDrafts = Record<string, FieldDraft>;

/** The value a field shows: the unsaved one when there is one. */
export function currentValue(field: CdaField, drafts: FieldDrafts): CdaFieldValue {
  const draft = drafts[field.field_key];
  return draft && "value" in draft ? (draft.value ?? null) : field.value;
}

/** Whether staff are overriding a figure from the system in this draft. */
export function isOverriding(field: CdaField, drafts: FieldDrafts): boolean {
  const draft = drafts[field.field_key];
  return field.source_key !== null && !!draft && "value" in draft && !draft.revert;
}

/**
 * What a field still needs before the save can go: an override of a figure
 * from the system needs its reason (the server refuses one without).
 */
export function missingReasons(sections: CdaSection[], drafts: FieldDrafts): string[] {
  const missing: string[] = [];
  for (const section of sections) {
    if (section.kind !== "fields") continue;
    for (const field of section.fields) {
      if (isOverriding(field, drafts) && !(drafts[field.field_key]?.override_reason ?? "").trim()) {
        missing.push(`Reason for overriding ${field.label}`);
      }
    }
  }
  return missing;
}

/**
 * The PUT body's fields: only what staff changed, and only on fields the
 * server says may change (editable, overridable, or overridden for a revert).
 */
export function fieldInputs(sections: CdaSection[], drafts: FieldDrafts): CdaFieldInput[] {
  const inputs: CdaFieldInput[] = [];
  for (const section of sections) {
    if (section.kind !== "fields") continue;
    for (const field of section.fields) {
      const draft = drafts[field.field_key];
      if (!draft) continue;
      const input: CdaFieldInput = { field_key: field.field_key };
      if (draft.revert && field.overridden) {
        input.revert = true;
      } else if ("value" in draft && (field.editable || field.overridable)) {
        input.value = draft.value ?? null;
        if (field.source_key !== null) input.override_reason = (draft.override_reason ?? "").trim();
      }
      if ("remarks" in draft && (field.editable || field.overridable || field.overridden)) {
        input.remarks = draft.remarks ?? null;
      }
      if (Object.keys(input).length > 1) inputs.push(input);
    }
  }
  return inputs;
}

/** Unsaved edits, held for the report they were typed on. */
export interface ReportDrafts {
  reportId: number;
  values: FieldDrafts;
}

/**
 * The unsaved edits that carry over a reload of the report (after a register
 * write): each one the reloaded report would still take, by the same rule as
 * the PUT body, shown over the reloaded figures. An edit on a field that is
 * gone, or can no longer change, is dropped rather than sent.
 */
export function carriedDrafts(sections: CdaSection[], drafts: FieldDrafts): FieldDrafts {
  const kept: FieldDrafts = {};
  for (const [fieldKey, draft] of Object.entries(drafts)) {
    if (fieldInputs(sections, { [fieldKey]: draft }).length > 0) kept[fieldKey] = draft;
  }
  return kept;
}

/** The edits that apply to this report: none when they were typed on another. */
export function draftsForReport(drafts: ReportDrafts, report: { id: number; sections: CdaSection[] }): FieldDrafts {
  return drafts.reportId === report.id ? carriedDrafts(report.sections, drafts.values) : {};
}

/**
 * Why the report is read again. A register write keeps the unsaved edits; a
 * conflict (409) starts from the server's report, as it always has.
 */
export type ReportReload = "register" | "conflict";

export function draftsAfterReload(drafts: ReportDrafts, reason: ReportReload): ReportDrafts {
  return reason === "register" ? drafts : { reportId: drafts.reportId, values: {} };
}

/** What an input's text becomes on the wire: blank is null, everything else as typed. */
export function fromInputText(raw: string): CdaFieldValue {
  return raw.trim() === "" ? null : raw;
}

/** A field's value in words, as the screen shows it. */
export function formatFieldValue(field: Pick<CdaField, "type" | "options">, value: CdaFieldValue): string {
  if (value === null || value === "") return "—";
  switch (field.type) {
    case "boolean":
      return value === true ? "Yes" : value === false ? "No" : "—";
    case "select":
      return optionLabel(field.options ?? [], value);
    case "compliance":
      return optionLabel(COMPLIANCE_OPTIONS, value);
    default:
      return formatByFormat(field.type, value);
  }
}

/** A table cell in words, by its column's format. */
export function formatCell(format: CdaColumnFormat | undefined, value: CdaFieldValue): string {
  if (value === null || value === "") return "—";
  return formatByFormat(format ?? "text", value);
}

function formatByFormat(format: string, value: CdaFieldValue): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value);
  switch (format) {
    case "money":
      return cdaMoney(text);
    case "percent":
      return cdaPercent(text);
    case "date":
      return /^\d{4}-\d{2}-\d{2}/.test(text) ? formatDate(text) : text;
    default:
      return asSent(text);
  }
}

function optionLabel(options: { value: string; label: string }[], value: CdaFieldValue): string {
  return options.find((o) => o.value === value)?.label ?? "Other";
}

/** Whether the report is waiting on a document: an issue about one is open now. */
export function needsDocument(report: { issues: CdaIssue[] }): boolean {
  return report.issues.some((i) => i.component === "documents" || i.category === "compliance_document");
}
