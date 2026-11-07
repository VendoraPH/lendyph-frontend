import { formatValue, type ColumnFormat } from "@/lib/report-format";
import type {
  CdaField,
  CdaFieldType,
  CdaFieldValue,
  CdaReportUpdate,
  CdaSection,
  CdaTableColumn,
} from "@/types/cda";

/** Unsaved edits to a report's manual fields, keyed `section.field`. */
export type FieldDrafts = Record<string, { value: CdaFieldValue; remarks?: string | null }>;

export const COMPLIANCE_OPTIONS = [
  { value: "compliant", label: "Compliant" },
  { value: "partial", label: "Partially compliant" },
  { value: "non_compliant", label: "Non-compliant" },
  { value: "not_applicable", label: "N/A" },
];

export function draftKey(sectionKey: string, fieldKey: string): string {
  return `${sectionKey}.${fieldKey}`;
}

const FIELD_FORMAT: Partial<Record<CdaFieldType, ColumnFormat>> = {
  money: "currency",
  number: "number",
  percent: "percent",
  date: "date",
};

const TABLE_FORMAT: Record<NonNullable<CdaTableColumn["format"]>, ColumnFormat> = {
  text: "text",
  number: "number",
  money: "currency",
  percent: "percent",
  date: "date",
};

/** A field's value as it reads on screen and in every export. */
export function formatFieldValue(field: Pick<CdaField, "type" | "value" | "options">): string {
  const { type, value } = field;
  if (type === "boolean") return value === null ? formatValue(null) : value ? "Yes" : "No";
  if (type === "select" || type === "compliance") {
    const options = type === "compliance" ? COMPLIANCE_OPTIONS : (field.options ?? []);
    return options.find((o) => o.value === value)?.label ?? formatValue(value);
  }
  return formatValue(value, FIELD_FORMAT[type]);
}

export function formatTableValue(value: CdaFieldValue, column: CdaTableColumn): string {
  return formatValue(value, column.format ? TABLE_FORMAT[column.format] : undefined);
}

/** The value a field shows: the unsaved draft if there is one. */
export function currentValue(sectionKey: string, field: CdaField, drafts: FieldDrafts): CdaFieldValue {
  const draft = drafts[draftKey(sectionKey, field.key)];
  return draft ? draft.value : field.value;
}

function isBlank(value: CdaFieldValue): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

/** Labels of required, editable fields that are still empty, for `notifyValidation`. */
export function missingRequired(sections: CdaSection[], drafts: FieldDrafts): string[] {
  const missing: string[] = [];
  for (const section of sections) {
    if (section.kind !== "fields") continue;
    for (const field of section.fields) {
      if (field.required && field.editable && isBlank(currentValue(section.key, field, drafts))) {
        missing.push(field.label);
      }
    }
  }
  return missing;
}

/** Only the edited manual fields go on the wire; auto-pulled ones never do. */
export function collectEdits(sections: CdaSection[], drafts: FieldDrafts): CdaReportUpdate {
  const fields: CdaReportUpdate["fields"] = [];
  for (const section of sections) {
    if (section.kind !== "fields") continue;
    for (const field of section.fields) {
      const draft = drafts[draftKey(section.key, field.key)];
      if (!draft || !field.editable) continue;
      fields.push({ section_key: section.key, field_key: field.key, value: draft.value, remarks: draft.remarks });
    }
  }
  return { fields };
}

/** Form input text → the typed value the API expects. Empty is null, not 0. */
export function parseInput(type: CdaFieldType, raw: string): CdaFieldValue {
  if (raw.trim() === "") return null;
  if (type === "number" || type === "money" || type === "percent") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}
