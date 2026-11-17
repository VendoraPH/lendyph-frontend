"use client";

/**
 * A long form split into numbered steps (Arvin, 2026-11-17: a form that
 * doesn't fit at 1366 x 768 even at full width becomes a stepper). The one
 * shared stepper: forms don't build their own. The rules live in
 * `@/lib/form-stepper` and are unit-tested there.
 *
 * - The parent keeps its form state (the house `useState` object) and its own
 *   `<form onSubmit>`; the stepper only knows which step is open.
 * - Every step stays mounted and inactive ones are `hidden`, so uncontrolled
 *   inputs, file pickers and autofill keep what was typed.
 * - Next validates the open step through `validateStep`; in `create` mode a
 *   step opens only once the steps before it pass, in `edit` mode any step
 *   opens from the rail.
 * - The submit button is the form's own `type="submit"`, so the parent's
 *   `onSubmit` runs; the stepper never submits by itself. It shows on the last
 *   step in `create` mode and on every step in `edit` mode (the stored record
 *   is already complete). Before it submits, every step is validated again and
 *   the first failing one opens. Enter in a field on any step but the last
 *   means Next, in both modes.
 * - Errors found later (the parent's own checks, a server 422) go through the
 *   ref: `stepperRef.current?.showErrors(errors)` opens the first step holding
 *   one and focuses its first invalid field.
 * - Focus moves to the step's heading on every step change, and the change is
 *   announced politely. An invalid field is found by `name`, `id` or
 *   `data-field` equal to its key (`valid_ids.0.number` falls back to
 *   `valid_ids.0`, then `valid_ids`).
 *
 * Layout: the page root is `PageFill` and the form takes the rest:
 *
 *     <PageFill>
 *       <PageHeader … />
 *       <form onSubmit={handleSubmit} className={FIT_CLASSES.section}>
 *         <FormStepper ref={stepperRef} steps={STEPS} validateStep={…}
 *           submitLabel="Save Member" submitting={submitting} actions={<CancelLink />}>
 *           <FormStep id="personal"><div className={FORM_STEP_GRID.grid}>…</div></FormStep>
 *           <FormStep id="contact">…</FormStep>
 *         </FormStepper>
 *       </form>
 *     </PageFill>
 *
 * At fit the rail and the footer stay put and the open step scrolls inside its
 * `ScrollBox`; below fit the page scrolls and the footer ends the form. The
 * footer carries `data-fab-clear`. Field grids are the form's job: see
 * `FORM_STEP_GRID` in `@/lib/form-stepper` (1, 2, 3, then 4 columns).
 *
 * In a dialog (`layout="dialog"`) the step body always scrolls and the footer
 * pins to the dialog's foot, styled like `DialogFooter`; the rail switches on
 * the dialog's width. The form takes the dialog's remaining height:
 *
 *     <DialogContent className="sm:max-w-3xl">
 *       <DialogHeader><DialogTitle>Edit Loan Product</DialogTitle></DialogHeader>
 *       <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
 *         <FormStepper layout="dialog" mode="edit" steps={STEPS} … >…</FormStepper>
 *       </form>
 *     </DialogContent>
 *
 * Don't open another dialog from inside a step's body only for layout; a
 * dialog a field needs (a picker, a cropper) is fine, since Enter there is
 * left alone.
 *
 * Imported by path, not through the `@/components/common` barrel.
 */

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScrollBox } from "@/components/common/page-fill";
import { notifyValidation } from "@/lib/notify";
import {
  canGoToStep,
  enterGoesToNext,
  errorMessages,
  fieldKeyCandidates,
  firstErrorField,
  firstStepWithError,
  hasStepErrors,
  nextStepIndex,
  previousStepIndex,
  stepFooterButtons,
  stepperLayoutClasses,
  stepProgressPercent,
  stepProgressText,
  type FormStepDef,
  type FormStepperLayout,
  type FormStepperMode,
  type StepErrors,
} from "@/lib/form-stepper";
import { cn } from "@/lib/utils";

export type { FormStepDef, FormStepperLayout, FormStepperMode, StepErrors } from "@/lib/form-stepper";

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

interface StepperContext {
  steps: readonly FormStepDef[];
  currentId: string;
  /** Keeps heading ids unique when two steppers share step ids. */
  baseId: string;
}

const Ctx = createContext<StepperContext | null>(null);

interface FocusRequest {
  seq: number;
  stepId: string;
  /** The error key to focus; `null` focuses the step heading. */
  field: string | null;
  /** Report the step's first natively invalid control (a `required` input). */
  native: boolean;
}

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const NATIVE_INVALID = "input:invalid, select:invalid, textarea:invalid";
const PRIMARY = "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark";

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

export function FormStepper({
  steps,
  mode = "create",
  layout = "page",
  validateStep,
  onInvalid,
  submitLabel,
  submittingLabel,
  submitting = false,
  submitDisabled = false,
  actions,
  initialStepId,
  onStepChange,
  className,
  ref,
  children,
}: FormStepperProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const [currentId, setCurrentId] = useState(() =>
    initialStepId && steps.some((s) => s.id === initialStepId) ? initialStepId : (steps[0]?.id ?? "")
  );
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const count = steps.length;
  const index = Math.max(0, steps.findIndex((s) => s.id === currentId));
  const step = steps[index];
  const isLast = index === count - 1;
  const classes = stepperLayoutClasses(layout);
  const buttons = stepFooterButtons({ mode, index, count });
  const passedList = steps.map((s) => passed[s.id] === true);

  useEffect(() => {
    const panel = focusRequest
      ? rootRef.current?.querySelector<HTMLElement>(`[data-step-panel="${CSS.escape(focusRequest.stepId)}"]`)
      : null;
    if (!focusRequest || !panel) return;
    if (focusRequest.native) {
      const invalid = panel.querySelector<HTMLInputElement>(NATIVE_INVALID);
      if (invalid) {
        invalid.focus();
        invalid.reportValidity();
        return;
      }
    }
    if (focusRequest.field && focusField(panel, focusRequest.field)) return;
    panel.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [focusRequest]);

  function open(target: number, field: string | null = null, native = false) {
    const next = steps[target];
    if (!next) return;
    if (next.id !== currentId) {
      setCurrentId(next.id);
      setAnnouncement(stepProgressText(target, count, next.title));
      onStepChange?.(next.id);
    }
    setFocusRequest((r) => ({ seq: (r?.seq ?? 0) + 1, stepId: next.id, field, native }));
  }

  function markPassed(ids: string[], ok: boolean) {
    setPassed((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, ok])) }));
  }

  /** Validates one step; on errors marks it, shows them and opens it. */
  function check(i: number): boolean {
    const target = steps[i];
    const result = validateStep ? validateStep(target.id) : true;
    if (result === true || !hasStepErrors(result)) {
      markPassed([target.id], true);
      return true;
    }
    markPassed([target.id], false);
    if (onInvalid) onInvalid(result, target.id);
    else notifyValidation(errorMessages(result));
    open(i, firstErrorField(result, target.fields));
    return false;
  }

  function goNext() {
    if (!isLast && check(index)) open(nextStepIndex(index, count));
  }

  function goTo(target: number) {
    if (target === index || !canGoToStep(target, { mode, current: index, passed: passedList })) return;
    if (target > index && mode === "create" && !check(index)) return;
    open(target);
  }

  function handleSubmitClick(event: MouseEvent<HTMLButtonElement>) {
    for (let i = 0; i < count; i++) {
      if (!check(i)) {
        event.preventDefault();
        return;
      }
    }
    // A `required` control on a hidden step would block the submit with no
    // message the user can see, so open its step and report it there.
    const invalid = rootRef.current?.querySelector(NATIVE_INVALID);
    const panelId = invalid?.closest<HTMLElement>("[data-step-panel]")?.dataset.stepPanel;
    const panelIndex = steps.findIndex((s) => s.id === panelId);
    if (panelIndex !== -1 && panelIndex !== index) {
      event.preventDefault();
      open(panelIndex, null, true);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // Keys from a dialog portalled out of a step still bubble here through React.
    if (!rootRef.current?.contains(target)) return;
    const goesNext = enterGoesToNext({
      key: event.key,
      tagName: target.tagName,
      inputType: target instanceof HTMLInputElement ? target.type : undefined,
      isComposing: event.nativeEvent.isComposing,
      defaultPrevented: event.defaultPrevented,
      isLastStep: isLast,
    });
    if (!goesNext) return;
    event.preventDefault();
    goNext();
  }

  useImperativeHandle(ref, () => ({
    showErrors(errors) {
      const target = firstStepWithError(errors, steps);
      if (target === -1) return false;
      markPassed([steps[target].id], false);
      open(target, firstErrorField(errors, steps[target].fields));
      return true;
    },
    goTo(stepId) {
      const target = steps.findIndex((s) => s.id === stepId);
      if (target !== -1) open(target);
    },
  }));

  if (!step) return null;

  return (
    <Ctx.Provider value={{ steps, currentId: step.id, baseId }}>
      <div
        ref={rootRef}
        data-slot="form-stepper"
        className={cn(classes.root, className)}
        onKeyDown={handleKeyDown}
      >
        <StepRail
          compactClassName={classes.railCompact}
          fullClassName={classes.railFull}
          steps={steps}
          index={index}
          passed={passedList}
          reachable={(i) => !submitting && canGoToStep(i, { mode, current: index, passed: passedList })}
          onSelect={goTo}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <ScrollBox always={classes.scrollAlways} className="p-px">
          {children}
        </ScrollBox>
        <div data-fab-clear={classes.fabClear ? "" : undefined} className={classes.footer}>
          {actions ? <div className="mr-auto flex items-center gap-2">{actions}</div> : null}
          {buttons.back ? (
            <Button
              key="back"
              type="button"
              variant="outline"
              onClick={() => open(previousStepIndex(index, count))}
              disabled={submitting}
            >
              <ChevronLeft aria-hidden="true" />
              Back
            </Button>
          ) : null}
          {/* Distinct keys: a clicked Next must never turn into the submit button in place. */}
          {buttons.next ? (
            <Button
              key="next"
              type="button"
              variant={buttons.primary === "next" ? "default" : "outline"}
              onClick={goNext}
              disabled={submitting}
              className={buttons.primary === "next" ? PRIMARY : undefined}
            >
              Next
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : null}
          {buttons.submit ? (
            <Button
              key="submit"
              type="submit"
              onClick={handleSubmitClick}
              disabled={submitting || submitDisabled}
              className={PRIMARY}
            >
              {submitting ? (
                <>
                  <Spinner className="size-4" />
                  {submittingLabel ?? submitLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function StepRail({
  compactClassName,
  fullClassName,
  steps,
  index,
  passed,
  reachable,
  onSelect,
}: {
  compactClassName: string;
  fullClassName: string;
  steps: readonly FormStepDef[];
  index: number;
  passed: readonly boolean[];
  reachable: (i: number) => boolean;
  onSelect: (i: number) => void;
}) {
  const count = steps.length;
  return (
    <nav aria-label="Form steps" className="shrink-0">
      <div className={compactClassName}>
        <p className="text-sm font-medium">{stepProgressText(index, count, steps[index].title)}</p>
        <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-orange transition-[width] duration-300"
            style={{ width: `${stepProgressPercent(index, count)}%` }}
          />
        </div>
      </div>
      <ol className={fullClassName}>
        {steps.map((s, i) => {
          const current = i === index;
          const done = passed[i] && !current;
          return (
            <li key={s.id} className={cn("flex min-w-0 items-center gap-2", i < count - 1 && "flex-1")}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={!current && !reachable(i)}
                aria-current={current ? "step" : undefined}
                className="flex min-w-0 items-center gap-2 rounded-md p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer disabled:cursor-not-allowed"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    current && "border-brand-orange bg-brand-orange text-brand-orange-foreground",
                    done && "border-brand-orange bg-background text-brand-orange",
                    !current && !done && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "min-w-0 text-sm leading-tight",
                    current ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="sr-only">{`Step ${i + 1}: `}</span>
                  {s.title}
                  {done ? <span className="sr-only">, completed</span> : null}
                </span>
              </button>
              {i < count - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-0.5 min-w-4 flex-1 rounded-full", passed[i] ? "bg-brand-orange" : "bg-border")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * One step's content, with its title (and description) as a heading that
 * takes focus when the step opens. Mounted always; hidden while another step
 * is open. Sections inside use `h3`.
 */
export function FormStep({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const ctx = useContext(Ctx);
  const def = ctx?.steps.find((s) => s.id === id);
  if (!ctx || !def) return null;
  const headingId = `${ctx.baseId}-${id}-title`;
  return (
    <section
      data-step-panel={id}
      hidden={ctx.currentId !== id}
      aria-labelledby={headingId}
      className={cn("space-y-6", className)}
    >
      <div className="space-y-1">
        <h2 id={headingId} data-step-heading tabIndex={-1} className="text-base font-semibold outline-none">
          {def.title}
        </h2>
        {def.description ? <p className="max-w-prose text-sm text-muted-foreground">{def.description}</p> : null}
      </div>
      {children}
    </section>
  );
}
