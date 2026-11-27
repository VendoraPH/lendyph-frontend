/**
 * Small pieces the savings forms share with `FormStepper` (Arvin, 2026-11-17:
 * long forms become numbered steps). Dependency-free, so it runs under
 * `tsx --test`.
 */

import { stepErrorsOf, type FormStepDef } from "@/lib/form-stepper";

/** A 422's field errors (`errors`, field key to messages), for `showErrors`; empty for any other answer. */
export function serverStepErrors(err: unknown): Record<string, string[]> {
  const response = (err as { response?: { status?: number; data?: { errors?: unknown } } } | null)?.response;
  const errors = response?.status === 422 ? response.data?.errors : null;
  if (!errors || typeof errors !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) out[key] = value.filter((m): m is string => typeof m === "string" && m !== "");
  }
  return out;
}

/**
 * The server's message for one field of a 422, shown under that field (a
 * refused duplicate reference, say); null for any other answer.
 */
export function serverFieldError(err: unknown, field: string): string | null {
  return serverStepErrors(err)[field]?.[0] ?? null;
}

/** The entries that hold a message, so a form's `{ field: null }` reads as no error. */
export function presentErrors(errors: Record<string, string | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (message) out[key] = message;
  }
  return out;
}

/**
 * `validateStep` for a form whose checks are one map keyed by field: the
 * errors of step `id`, or `true` when it has none.
 */
export function errorsForStep(
  errors: Record<string, string>,
  steps: readonly FormStepDef[],
  id: string,
): Record<string, string> | true {
  const step = steps.find((s) => s.id === id);
  const own = step ? stepErrorsOf(errors, step) : {};
  return Object.keys(own).length > 0 ? own : true;
}
