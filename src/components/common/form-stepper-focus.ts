"use client";

/**
 * `FormStepper`'s focus handling, the DOM half of its rules: after a step
 * opens, focus its heading, its first invalid field, or its first natively
 * invalid control. Private to `form-stepper.tsx`.
 */

import { useEffect, useState, type RefObject } from "react";
import { fieldKeyCandidates } from "@/lib/form-stepper";

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const NATIVE_INVALID = "input:invalid, select:invalid, textarea:invalid";

interface FocusRequest {
  seq: number;
  stepId: string;
  /** The error key to focus; `null` focuses the step heading. */
  field: string | null;
  /** Report the step's first natively invalid control (a `required` input). */
  native: boolean;
}

/**
 * The field for an error key, by `name`, `id` or `data-field` (a wrapper whose
 * first focusable control is used), trying `valid_ids.0.number`, then
 * `valid_ids.0`, then `valid_ids`.
 */
function focusField(panel: HTMLElement, key: string): boolean {
  for (const candidate of fieldKeyCandidates(key)) {
    const k = CSS.escape(candidate);
    for (const el of panel.querySelectorAll<HTMLElement>(`[name="${k}"], [id="${k}"], [data-field="${k}"]`)) {
      const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
      if (target && document.activeElement === target) return true;
    }
  }
  return false;
}

/**
 * The step holding the stepper's first natively invalid control, if any: a
 * `required` control on a hidden step would block the submit with no message
 * the user can see.
 */
export function nativeInvalidStepId(root: HTMLElement | null): string | undefined {
  const invalid = root?.querySelector(NATIVE_INVALID);
  return invalid?.closest<HTMLElement>("[data-step-panel]")?.dataset.stepPanel;
}

/**
 * Returns `requestFocus(stepId, field, native)`; the focus happens after the
 * render that shows the step.
 */
export function useStepFocus(rootRef: RefObject<HTMLElement | null>) {
  const [request, setRequest] = useState<FocusRequest | null>(null);

  useEffect(() => {
    const panel = request
      ? rootRef.current?.querySelector<HTMLElement>(`[data-step-panel="${CSS.escape(request.stepId)}"]`)
      : null;
    if (!request || !panel) return;
    if (request.native) {
      const invalid = panel.querySelector<HTMLInputElement>(NATIVE_INVALID);
      if (invalid) {
        invalid.focus();
        invalid.reportValidity();
        return;
      }
    }
    if (request.field && focusField(panel, request.field)) return;
    panel.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [request, rootRef]);

  return function requestFocus(stepId: string, field: string | null, native: boolean) {
    setRequest((r) => ({ seq: (r?.seq ?? 0) + 1, stepId, field, native }));
  };
}
