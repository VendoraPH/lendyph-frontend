/**
 * Field-list driven register forms (carried over from #510 by Augustin). Every
 * CDA register row is a flat record, so one form handles officers, trainings,
 * social programs, mediation cases and documents from a field list.
 *
 * Money and hours go to the server exactly as typed: the server checks them
 * (two decimals, not negative) and answers in words.
 */

export type RecordFieldType = "text" | "textarea" | "number" | "money" | "date" | "select" | "checkbox";

export interface RecordField {
  key: string;
  label: string;
  type: RecordFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
}

/** What the form sends: text as typed, a whole number for a count, true or false for a checkbox, null when blank. */
export type RecordValue = string | number | boolean | null;
export type RecordValues = Record<string, RecordValue>;
/** Form state: every input is text until submit; a checkbox is "1" or "". */
export type RecordDraft = Record<string, string>;

/** A record (or nothing, for a new one) → the form's text inputs. */
export function toDraft(fields: RecordField[], record?: object | null, defaults: RecordDraft = {}): RecordDraft {
  const source = (record ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    fields.map((f) => {
      const v = record ? source[f.key] : undefined;
      if (f.type === "checkbox") return [f.key, v === true || v === 1 || (v === undefined && defaults[f.key] === "1") ? "1" : ""];
      if (v === null || v === undefined) return [f.key, defaults[f.key] ?? ""];
      return [f.key, String(v)];
    }),
  );
}

/** Labels of required fields left blank. */
export function missingFields(fields: RecordField[], draft: RecordDraft): string[] {
  return fields.filter((f) => f.required && f.type !== "checkbox" && !(draft[f.key] ?? "").trim()).map((f) => f.label);
}

/**
 * Text inputs → what the API takes. Blank is null; a count is a whole number
 * when it reads as one (anything else goes as typed, for the server to refuse
 * in words); money stays text; a checkbox is true or false.
 */
export function fromDraft(fields: RecordField[], draft: RecordDraft): RecordValues {
  return Object.fromEntries(
    fields.map((f) => {
      const raw = (draft[f.key] ?? "").trim();
      if (f.type === "checkbox") return [f.key, raw === "1"];
      if (raw === "") return [f.key, null];
      if (f.type === "number" && /^\d+$/.test(raw)) return [f.key, Number(raw)];
      return [f.key, raw];
    }),
  );
}
