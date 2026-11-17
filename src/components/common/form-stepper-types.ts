/**
 * `FormStepper`'s public types. Import them from `form-stepper.tsx`, which
 * re-exports them.
 */

import type { ReactNode, Ref } from "react";
import type { FormStepDef, FormStepperLayout, FormStepperMode, StepErrors } from "@/lib/form-stepper";

/** What the parent can do through `ref`. */
export interface FormStepperHandle {
  /**
   * Opens the first step holding one of `errors` (field key to message, a 422's
   * `errors` fits) and focuses its first invalid field. Shows nothing itself:
   * the form's own error display does. Returns false when no error belongs to
   * a step, and the open step stays.
   */
  showErrors: (errors: StepErrors) => boolean;
  /** Opens a step by id, whatever the mode (e.g. after loading a draft). */
  goTo: (stepId: string) => void;
}

export interface FormStepperProps {
  steps: readonly FormStepDef[];
  /**
   * `create` (default): steps open in order, and Save shows on the last step.
   * `edit`: any step opens, and Save shows on every step.
   */
  mode?: FormStepperMode;
  /** `page` (default) inside `PageFill`, or `dialog` inside `DialogContent`. */
  layout?: FormStepperLayout;
  /**
   * The errors for one step's fields, or `true` when it passes. Keep it free
   * of side effects: it also runs for every step on submit.
   */
  validateStep?: (stepId: string) => StepErrors | true;
  /**
   * Shows a failed step's errors. Defaults to one `notifyValidation` toast
   * listing the messages, so returning field labels as messages reads like
   * today's forms ("Please complete: First name and Email.").
   */
  onInvalid?: (errors: StepErrors, stepId: string) => void;
  /** The submit button's label, e.g. "Save Member". */
  submitLabel: ReactNode;
  /** Shown with a spinner while `submitting`, e.g. "Saving…". */
  submittingLabel?: ReactNode;
  submitting?: boolean;
  /** Disables the submit button, e.g. while a duplicate check runs. */
  submitDisabled?: boolean;
  /** Left of the footer, e.g. the Cancel link. */
  actions?: ReactNode;
  initialStepId?: string;
  onStepChange?: (stepId: string) => void;
  className?: string;
  ref?: Ref<FormStepperHandle>;
  /** One `<FormStep id>` per step. */
  children: ReactNode;
}
