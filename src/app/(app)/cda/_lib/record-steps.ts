/**
 * Steps for a long register form (Arvin, 2026-11-17: a dialog that doesn't
 * fit at 1366 x 768 becomes a stepper). A register lists its step groups by
 * field key, in the form's own order; `RecordFormDialog` turns them into
 * `FormStepper` steps. Layout only: the fields, their order, the required
 * check and the payload are the field list's, as before.
 */

import type { FormStepDef, StepErrors } from "@/lib/form-stepper";
import type { RecordDraft, RecordField } from "./record-form";

/** One step: its title and the keys of its fields (the attachment by its server key). */
export interface RecordStepGroup {
  id: string;
  title: string;
  fields: readonly string[];
}

/**
 * The steps for the fields a form shows. A group keeps only the fields the
 * form has (the attachment only while `fileKey` is offered), and a group left
 * empty is dropped. A field no group names goes on the last step, so a field
 * is never lost from the form.
 */
export function recordSteps(
  groups: readonly RecordStepGroup[],
  fields: readonly RecordField[],
  fileKey: string | null = null,
): FormStepDef[] {
  const shown = [...fields.map((f) => f.key), ...(fileKey ? [fileKey] : [])];
  const steps = groups
    .map((g) => ({ id: g.id, title: g.title, fields: g.fields.filter((k) => shown.includes(k)) }))
    .filter((s) => s.fields.length > 0);
  const named = new Set(groups.flatMap((g) => g.fields));
  const loose = shown.filter((k) => !named.has(k));
  if (loose.length > 0 && steps.length > 0) {
    const last = steps[steps.length - 1];
    steps[steps.length - 1] = { ...last, fields: [...last.fields, ...loose] };
  }
  return steps;
}

/** How a form's keys sit in its groups: none missing, none twice, none unknown, in the form's order. */
export function groupCoverage(
  groups: readonly RecordStepGroup[],
  keys: readonly string[],
): { missing: string[]; repeated: string[]; unknown: string[]; inOrder: boolean } {
  const listed = groups.flatMap((g) => g.fields);
  const repeated = [...new Set(listed.filter((k, i) => listed.indexOf(k) !== i))];
  const known = listed.filter((k) => keys.includes(k));
  const unique = known.filter((k, i) => known.indexOf(k) === i);
  const formOrder = keys.filter((k) => unique.includes(k));
  return {
    missing: keys.filter((k) => !listed.includes(k)),
    repeated,
    unknown: listed.filter((k) => !keys.includes(k)),
    inOrder: unique.every((k, i) => k === formOrder[i]),
  };
}

/**
 * The step's required fields left blank, key to label: the same rule as
 * `missingFields` (a checkbox is never missing). `missingFile` is the
 * attachment still needed, reported on the step that holds it.
 */
export function recordStepErrors(
  step: FormStepDef,
  fields: readonly RecordField[],
  draft: RecordDraft,
  missingFile: { key: string; label: string } | null = null,
): StepErrors {
  const keys = step.fields ?? [];
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (keys.includes(f.key) && f.required && f.type !== "checkbox" && !(draft[f.key] ?? "").trim()) {
      errors[f.key] = f.label;
    }
  }
  if (missingFile && keys.includes(missingFile.key)) errors[missingFile.key] = missingFile.label;
  return errors;
}

type ValidationReply = { response?: { status?: number; data?: { errors?: unknown } } };

/** A server 422's field errors, for the stepper to open their step; null for any other failure. */
export function serverFieldErrors(err: unknown): StepErrors | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const response = (err as ValidationReply).response;
  if (response?.status !== 422) return null;
  const errors = response.data?.errors;
  return errors && typeof errors === "object" ? (errors as StepErrors) : null;
}
