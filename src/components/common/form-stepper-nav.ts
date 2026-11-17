"use client";

/**
 * `FormStepper`'s state: the open step, which steps passed, the polite
 * announcement, and moving between steps with validation on the way. Private
 * to `form-stepper.tsx`.
 */

import { useState, type RefObject } from "react";
import { useStepFocus } from "@/components/common/form-stepper-focus";
import type { FormStepperProps } from "@/components/common/form-stepper-types";
import { notifyValidation } from "@/lib/notify";
import {
  canGoToStep,
  errorMessages,
  firstErrorField,
  hasStepErrors,
  nextStepIndex,
  stepProgressText,
  type FormStepperMode,
} from "@/lib/form-stepper";

type NavOptions = Pick<FormStepperProps, "steps" | "validateStep" | "onInvalid" | "initialStepId" | "onStepChange"> & {
  mode: FormStepperMode;
  rootRef: RefObject<HTMLElement | null>;
};

export function useStepperNav({ steps, mode, validateStep, onInvalid, initialStepId, onStepChange, rootRef }: NavOptions) {
  const requestFocus = useStepFocus(rootRef);
  const [currentId, setCurrentId] = useState(() =>
    initialStepId && steps.some((s) => s.id === initialStepId) ? initialStepId : (steps[0]?.id ?? "")
  );
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const [announcement, setAnnouncement] = useState("");

  const count = steps.length;
  const index = Math.max(0, steps.findIndex((s) => s.id === currentId));
  const isLast = index === count - 1;
  const passedList = steps.map((s) => passed[s.id] === true);

  /** Opens a step and focuses its heading, or `field`, or its natively invalid control. */
  function open(target: number, field: string | null = null, native = false) {
    const next = steps[target];
    if (!next) return;
    if (next.id !== currentId) {
      setCurrentId(next.id);
      setAnnouncement(stepProgressText(target, count, next.title));
      onStepChange?.(next.id);
    }
    requestFocus(next.id, field, native);
  }

  function markPassed(id: string, ok: boolean) {
    setPassed((p) => ({ ...p, [id]: ok }));
  }

  /** Validates one step; on errors marks it, shows them and opens it. */
  function check(i: number): boolean {
    const target = steps[i];
    const result = validateStep ? validateStep(target.id) : true;
    if (result === true || !hasStepErrors(result)) {
      markPassed(target.id, true);
      return true;
    }
    markPassed(target.id, false);
    if (onInvalid) onInvalid(result, target.id);
    else notifyValidation(errorMessages(result));
    open(i, firstErrorField(result, target.fields));
    return false;
  }

  function goNext() {
    if (!isLast && check(index)) open(nextStepIndex(index, count));
  }

  /** From the rail or the phone menu; `create` validates the open step before moving on. */
  function goTo(target: number) {
    if (target === index || !canGoToStep(target, { mode, current: index, passed: passedList })) return;
    if (target > index && mode === "create" && !check(index)) return;
    open(target);
  }

  return { index, isLast, passedList, announcement, open, markPassed, check, goNext, goTo };
}
