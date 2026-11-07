/**
 * Field-config driven register forms. Every CDA register (officers,
 * trainings, social programs, mediation, documents, submissions) is a flat
 * record, so one form handles them all from a field list.
 */

export type RecordFieldType = "text" | "textarea" | "number" | "money" | "date" | "select";

export interface RecordField {
  key: string;
  label: string;
  type: RecordFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export type RecordValue = string | number | null;
export type RecordValues = Record<string, RecordValue>;
/** Form state: every input is text until submit. */
export type RecordDraft = Record<string, string>;

/** A record (or nothing, for a new one) → the form's text inputs. */
export function toDraft(fields: RecordField[], record?: object | null): RecordDraft {
  const source = (record ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    fields.map((f) => {
      const v = source[f.key];
      return [f.key, v === null || v === undefined ? "" : String(v)];
    }),
  );
}

/** Labels of required fields left blank. */
export function missingFields(fields: RecordField[], draft: RecordDraft): string[] {
  return fields.filter((f) => f.required && !(draft[f.key] ?? "").trim()).map((f) => f.label);
}

/** Text inputs → typed values. Blank is null; numeric fields become numbers. */
export function fromDraft(fields: RecordField[], draft: RecordDraft): RecordValues {
  return Object.fromEntries(
    fields.map((f) => {
      const raw = (draft[f.key] ?? "").trim();
      if (raw === "") return [f.key, null];
      if (f.type === "number" || f.type === "money") {
        const n = Number(raw);
        return [f.key, Number.isFinite(n) ? n : null];
      }
      return [f.key, raw];
    }),
  );
}
