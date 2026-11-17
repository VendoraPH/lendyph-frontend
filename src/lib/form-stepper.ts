/**
 * The rules behind `FormStepper` (`components/common/form-stepper.tsx`), as
 * pure functions so they can be unit-tested: moving between steps, which steps
 * can be reached, mapping field errors to steps, the "Step n of m" text, and
 * when Enter means Next, which footer buttons show, and the classes for a
 * stepper on a page or in a dialog.
 *
 * Steps are addressed by index here; the component maps them to the step ids
 * the form uses.
 */

import { FIT_CLASSES } from "./page-fill";

/**
 * `create`: a step opens only once every step before it has passed its
 * validation. `edit`: every step can be opened at any time.
 */
export type FormStepperMode = "create" | "edit";

export interface FormStepDef {
  /** Stable key for the step; `<FormStep id>` and `validateStep` use it. */
  id: string;
  /** Short title, shown in the step rail and as the step's heading. */
  title: string;
  /** One line under the step's heading. */
  description?: string;
  /**
   * The form's field keys that belong to this step. They scope validation and
   * let an error on `email` (or a server key under it, such as
   * `valid_ids.0.id_number` under `valid_ids`) open the right step.
   */
  fields?: readonly string[];
}

/**
 * Field key to message. A server 422's `errors` (arrays of messages) fits as
 * is; an empty string, an empty array, `null` or `undefined` is no error.
 */
export type StepErrors = Record<string, string | readonly string[] | null | undefined>;

/**
 * Field grids inside a step widen with the screen (Arvin, 2026-11-17): one
 * column on phones, 2 at `md`, 3 at `xl` and 4 at `2xl` where fields are
 * short. A long field (address, remarks) takes `wide` or `full`.
 *
 *     <div className={FORM_STEP_GRID.grid}>
 *       <Field … />
 *       <Field className={FORM_STEP_GRID.full} … />
 *     </div>
 *
 * The forms apply these; the stepper doesn't, since some steps hold cards,
 * tables or uploaders rather than one grid.
 */
export const FORM_STEP_GRID = {
  /** Short fields: 1, 2, 3, then 4 columns. */
  grid: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  /** Fields that need more room: 1, 2, then 3 columns. */
  roomy: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
  /** A field two columns wide from `md` (an address line). */
  wide: "md:col-span-2",
  /** A field across the whole row (remarks, an uploader). */
  full: "col-span-full",
} as const;

/**
 * Where the stepper sits. `page`: inside a `PageFill` page, fitting the screen
 * only at `fit:` (below it the page scrolls and the footer ends the form).
 * `dialog`: inside a `DialogContent`, where the step body always scrolls and
 * the footer pins to the dialog's foot.
 */
export type FormStepperLayout = "page" | "dialog";

export interface StepperLayoutClasses {
  /** The stepper's root column. */
  root: string;
  /** Whether the step body's `ScrollBox` scrolls at every size (`always`). */
  scrollAlways: boolean;
  /** The footer bar. */
  footer: string;
  /** Whether the footer carries `data-fab-clear` (Linda's floating button). */
  fabClear: boolean;
  /** The "Step 2 of 4 · Contact" line with its bar, for narrow widths. */
  railCompact: string;
  /** The numbered rail, for wider ones. */
  railFull: string;
}

const LAYOUTS: Record<FormStepperLayout, StepperLayoutClasses> = {
  page: {
    root: `${FIT_CLASSES.section} gap-4`,
    scrollAlways: false,
    footer: "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t pt-4",
    fabClear: true,
    railCompact: "space-y-2 md:hidden",
    railFull: "hidden items-center gap-2 md:flex",
  },
  dialog: {
    // A dialog is narrower than the screen, so the rail follows the dialog's
    // own width (container query) rather than the viewport's.
    // From sm the stepper has one fixed height, so the dialog never resizes
    // and the footer never moves between steps: a taller step scrolls inside
    // the body, a shorter one leaves room below it. Hidden steps take no
    // room, which is why a minimum height wasn't enough. `sm:flex-initial`
    // lets the height apply (flex-1's zero basis ignores it) while the root
    // can still shrink inside a short screen's dialog. Phones keep a dialog
    // sized to its content. A form can override the height through
    // `className` (e.g. `sm:h-[min(44rem,80dvh)]`).
    root: "@container flex min-h-0 flex-1 flex-col gap-4 sm:h-[min(36rem,70dvh)] sm:flex-initial",
    scrollAlways: true,
    // DialogFooter's own look, so a stepper dialog matches the others.
    footer:
      "-mx-4 -mb-4 flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4",
    fabClear: false,
    railCompact: "space-y-2 @xl:hidden",
    railFull: "hidden items-center gap-2 @xl:flex",
  },
};

/** The class lists for a stepper on a page or in a dialog. */
export function stepperLayoutClasses(layout: FormStepperLayout): StepperLayoutClasses {
  return LAYOUTS[layout];
}

/** Which footer buttons show, and which one is the main (filled) button. */
export interface StepFooterButtons {
  back: boolean;
  next: boolean;
  submit: boolean;
  primary: "next" | "submit";
}

/**
 * The footer for a step.
 *
 * - Back from the second step on; Next on every step but the last.
 * - `create`: the submit button only on the last step, and Next is the main
 *   button until then.
 * - `edit`: the submit button on every step, as the main button, because the
 *   stored record is already complete (coordinator, 2026-11-17).
 */
export function stepFooterButtons({
  mode,
  index,
  count,
}: {
  mode: FormStepperMode;
  index: number;
  count: number;
}): StepFooterButtons {
  const at = clamp(index, count);
  const last = at >= count - 1;
  const submit = mode === "edit" || last;
  return { back: at > 0, next: !last, submit, primary: submit ? "submit" : "next" };
}

function clamp(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** The step after `current`, staying on the last one. */
export function nextStepIndex(current: number, count: number): number {
  return clamp(clamp(current, count) + 1, count);
}

/** The step before `current`, staying on the first one. */
export function previousStepIndex(current: number, count: number): number {
  return clamp(clamp(current, count) - 1, count);
}

/**
 * Whether the step at `target` can be opened from `current`.
 *
 * - `edit`: any step.
 * - `create`: the current step and any before it; a later step only when
 *   every step before it has passed. The current step counts as passable,
 *   because moving forward validates it on the way (the component does that),
 *   so the step right after the current one is always offered.
 * - `nextDisabled` (the form's own "not yet", e.g. a source loan still
 *   loading): in `create` no later step opens, from Next or the rail; earlier
 *   steps still do. `edit` keeps every step open.
 */
export function canGoToStep(
  target: number,
  {
    mode,
    current,
    passed,
    nextDisabled = false,
  }: { mode: FormStepperMode; current: number; passed: readonly boolean[]; nextDisabled?: boolean }
): boolean {
  if (target < 0 || target >= passed.length) return false;
  if (mode === "edit" || target <= current) return true;
  if (nextDisabled) return false;
  for (let i = 0; i < target; i++) {
    if (i !== current && !passed[i]) return false;
  }
  return true;
}

/** `valid_ids.0.number` belongs to `valid_ids`; `email_2` doesn't belong to `email`. */
function belongsTo(key: string, field: string): boolean {
  return key === field || key.startsWith(`${field}.`);
}

function hasMessage(value: StepErrors[string]): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return value.some((m) => m.trim() !== "");
}

function firstMessage(value: StepErrors[string]): string {
  if (typeof value === "string") return value;
  return value?.find((m) => m.trim() !== "") ?? "";
}

/** The index of the step that lists `field` (or a field it sits under); -1 if none. */
export function stepIndexForField(field: string, steps: readonly FormStepDef[]): number {
  return steps.findIndex((s) => (s.fields ?? []).some((f) => belongsTo(field, f)));
}

/**
 * The first step, in step order, holding any of the errors; -1 when none of
 * them belongs to a step (a form-wide error, such as a missing branch).
 */
export function firstStepWithError(errors: StepErrors, steps: readonly FormStepDef[]): number {
  let first = -1;
  for (const [key, value] of Object.entries(errors)) {
    if (!hasMessage(value)) continue;
    const index = stepIndexForField(key, steps);
    if (index !== -1 && (first === -1 || index < first)) first = index;
  }
  return first;
}

/** The errors that belong to `step`, one message each. */
export function stepErrorsOf(errors: StepErrors, step: FormStepDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (hasMessage(value) && (step.fields ?? []).some((f) => belongsTo(key, f))) {
      out[key] = firstMessage(value);
    }
  }
  return out;
}

/** Whether a `validateStep` result holds any error (`true` and `{}` hold none). */
export function hasStepErrors(result: StepErrors | true): boolean {
  return result !== true && Object.values(result).some(hasMessage);
}

/**
 * Whether the browser's own constraints (required, min, max, step, pattern…)
 * count, for Next and for submit. A form with `noValidate` opted out, so it
 * accepts exactly what it accepted before it was a stepper (the loan form's
 * whole-peso Build-Up input takes ₱50.50); so does a submit button with
 * `formNoValidate`. Outside a form there is nothing to check.
 */
export function nativeValidityApplies(
  form: { noValidate: boolean } | null | undefined,
  submitter?: { formNoValidate: boolean }
): boolean {
  if (!form || form.noValidate) return false;
  return !submitter?.formNoValidate;
}

/**
 * Why a step doesn't pass, if it doesn't: `native` (a control the browser
 * marks invalid, reported with the browser's own message) comes first, as on
 * a real multi-page form, then `custom` (`validateStep`'s errors). `null`
 * when it passes. Native checks count only where `nativeValidityApplies`.
 */
export function stepCheckFailure({
  nativeApplies,
  nativeInvalid,
  result,
}: {
  nativeApplies: boolean;
  nativeInvalid: boolean;
  result: StepErrors | true;
}): "native" | "custom" | null {
  if (nativeApplies && nativeInvalid) return "native";
  return hasStepErrors(result) ? "custom" : null;
}

/**
 * Every message in an errors map, once each and in order: what the default
 * `notifyValidation` toast lists when a step fails (so a form whose messages
 * are its field labels reads "Please complete: First name and Email.").
 */
export function errorMessages(errors: StepErrors): string[] {
  const out: string[] = [];
  for (const value of Object.values(errors)) {
    const list = typeof value === "string" ? [value] : (value ?? []);
    for (const message of list) {
      if (message.trim() !== "" && !out.includes(message)) out.push(message);
    }
  }
  return out;
}

/**
 * The error key to focus: the first in the step's field order, else the first
 * in the map's own order. `null` when there is no error.
 */
export function firstErrorField(errors: StepErrors, fields: readonly string[] = []): string | null {
  const keys = Object.keys(errors).filter((k) => hasMessage(errors[k]));
  for (const field of fields) {
    const hit = keys.find((k) => belongsTo(k, field));
    if (hit) return hit;
  }
  return keys[0] ?? null;
}

/**
 * The keys to look an error's field up by, most specific first, so
 * `valid_ids.0.number` finds that input, else the row, else the list.
 */
export function fieldKeyCandidates(key: string): string[] {
  const parts = key.split(".");
  return parts.map((_, i) => parts.slice(0, parts.length - i).join("."));
}

/** "Step 2 of 4", or "Step 2 of 4 · Contact" with a title. */
export function stepProgressText(index: number, count: number, title?: string): string {
  const base = `Step ${index + 1} of ${count}`;
  const name = title?.trim();
  return name ? `${base} · ${name}` : base;
}

/**
 * The phone step menu: in `edit` mode the compact "Step 2 of 4 · Contact" line
 * becomes a menu of every step, each labelled the same way, so an editor can
 * jump to any step on a phone too. `null` (the plain line) in `create` mode,
 * where steps open in order, and when there is only one step.
 */
export function stepMenuOptions(
  steps: readonly FormStepDef[],
  mode: FormStepperMode
): { id: string; label: string }[] | null {
  if (mode !== "edit" || steps.length < 2) return null;
  return steps.map((s, i) => ({ id: s.id, label: stepProgressText(i, steps.length, s.title) }));
}

/** How full the phone progress bar is: steps up to and including the current one, in %. */
export function stepProgressPercent(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((clamp(index, count) + 1) / count) * 100;
}

/** Input types where Enter submits a form natively (implicit submission). */
const NON_TEXT_INPUTS = new Set([
  "button",
  "submit",
  "reset",
  "image",
  "checkbox",
  "radio",
  "file",
  "color",
  "range",
  "hidden",
]);

/**
 * Whether an Enter key press should go to Next instead of submitting the form:
 * Enter in a text-like input on any step but the last. A picker that already
 * handled Enter (`defaultPrevented`), text areas, buttons and IME composition
 * are left alone, and so is the last step, where Enter submits as usual.
 */
export function enterGoesToNext(event: {
  key: string;
  tagName: string;
  inputType?: string;
  isComposing: boolean;
  defaultPrevented: boolean;
  isLastStep: boolean;
}): boolean {
  if (event.key !== "Enter" || event.isLastStep) return false;
  if (event.isComposing || event.defaultPrevented) return false;
  if (event.tagName.toUpperCase() !== "INPUT") return false;
  return !NON_TEXT_INPUTS.has((event.inputType ?? "text").toLowerCase());
}
