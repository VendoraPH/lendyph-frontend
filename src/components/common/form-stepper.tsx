"use client";

/**
 * A long form split into numbered steps (Arvin, 2026-11-17: a form that
 * doesn't fit at 1366 x 768 even at full width becomes a stepper). The one
 * shared stepper: forms don't build their own. The rules live in
 * `@/lib/form-stepper` and are unit-tested there; the rail, footer and focus
 * handling sit beside this file (`form-stepper-*`).
 *
 * - The parent keeps its `useState` form and its own `<form onSubmit>`; the
 *   stepper only knows which step is open.
 * - Every step stays mounted and inactive ones are `hidden`, so uncontrolled
 *   inputs, file pickers and autofill keep what was typed.
 * - Next validates the open step: the browser's own constraints first
 *   (required, min, pattern…, reported with the browser's message), then
 *   `validateStep`. A `noValidate` form skips the browser's checks entirely,
 *   so it accepts exactly what it did before. `create`: a step opens only once
 *   the steps before it pass (a click on a later rail step checks them and
 *   shows what's missing, as Next does), and Save shows on the last step.
 *   `edit`: any step opens (on phones through a step menu), and Save shows on
 *   every step. `onInvalid` is told whether Save or Next started the check.
 * - Save is the form's own `type="submit"`, so the parent's `onSubmit` runs;
 *   the stepper never submits by itself. Before it does, every step is
 *   validated again and the first failing one opens. Enter in a field on any
 *   step but the last means Next.
 * - Errors found later (the parent's checks, a 422) go through the ref:
 *   `stepperRef.current?.showErrors(errors)` opens the first step holding one
 *   and focuses that field, found by `name`, `id` or `data-field` equal to its
 *   key. Focus moves to the step's heading on every step change, which is
 *   announced politely.
 *
 * On a page (`layout="page"`, the default), inside `PageFill`:
 *
 *     <form onSubmit={handleSubmit} className={FIT_CLASSES.section}>
 *       <FormStepper ref={stepperRef} steps={STEPS} validateStep={…}
 *         submitLabel="Save Member" submitting={submitting} actions={<CancelLink />}>
 *         <FormStep id="personal"><div className={FORM_STEP_GRID.grid}>…</div></FormStep>
 *         <FormStep id="contact">…</FormStep>
 *       </FormStepper>
 *     </form>
 *
 * At fit the rail and footer stay put and the open step scrolls in its
 * `ScrollBox`; below fit the page scrolls and the footer ends the form. In a
 * dialog (`layout="dialog"`), the form is `flex min-h-0 flex-1 flex-col` inside
 * `DialogContent`: the step body always scrolls and the footer pins to the
 * dialog's foot. Field grids are the form's job: `FORM_STEP_GRID`.
 *
 * Imported by path, not through the `@/components/common` barrel.
 */

import {
  createContext,
  useContext,
  useId,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ScrollBox } from "@/components/common/page-fill";
import { StepFooter } from "@/components/common/form-stepper-footer";
import { useStepperNav } from "@/components/common/form-stepper-nav";
import { StepRail } from "@/components/common/form-stepper-rail";
import type { FormStepperProps } from "@/components/common/form-stepper-types";
import {
  canGoToStep,
  enterGoesToNext,
  firstErrorField,
  firstStepWithError,
  previousStepIndex,
  railStepClickable,
  stepFooterButtons,
  stepperLayoutClasses,
  type FormStepDef,
} from "@/lib/form-stepper";
import { cn } from "@/lib/utils";

export type { FormStepperHandle, FormStepperProps } from "@/components/common/form-stepper-types";
export type {
  FormStepDef,
  FormStepperLayout,
  FormStepperMode,
  StepCheckTrigger,
  StepErrors,
} from "@/lib/form-stepper";

interface StepperContext {
  steps: readonly FormStepDef[];
  currentId: string;
  /** Keeps heading ids unique when two steppers share step ids. */
  baseId: string;
}

const Ctx = createContext<StepperContext | null>(null);

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
  nextDisabled = false,
  submitDescribedBy,
  actions,
  initialStepId,
  onStepChange,
  className,
  ref,
  children,
}: FormStepperProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const nav = useStepperNav({ steps, mode, nextDisabled, validateStep, onInvalid, initialStepId, onStepChange, rootRef });
  const { index, isLast, passedList, open, markPassed } = nav;
  const count = steps.length;
  const step = steps[index];
  const classes = stepperLayoutClasses(layout);

  /** Every step is checked again, in order; the first failing one opens and the submit stops. */
  function handleSubmitClick(event: MouseEvent<HTMLButtonElement>) {
    for (let i = 0; i < count; i++) {
      if (!nav.check(i, "save", event.currentTarget)) {
        event.preventDefault();
        return;
      }
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
    nav.goNext();
  }

  useImperativeHandle(ref, () => ({
    showErrors(errors) {
      const target = firstStepWithError(errors, steps);
      if (target === -1) return false;
      markPassed(steps[target].id, false);
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
      <div ref={rootRef} data-slot="form-stepper" className={cn(classes.root, className)} onKeyDown={handleKeyDown}>
        <StepRail
          compactClassName={classes.railCompact}
          fullClassName={classes.railFull}
          mode={mode}
          steps={steps}
          index={index}
          passed={passedList}
          clickable={(i) => !submitting && railStepClickable(i, { mode, current: index, count, nextDisabled })}
          opensDirectly={(i) => canGoToStep(i, { mode, current: index, passed: passedList, nextDisabled })}
          onSelect={nav.goTo}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {nav.announcement}
        </p>
        <ScrollBox always={classes.scrollAlways} className="p-px">
          {children}
        </ScrollBox>
        <StepFooter
          buttons={stepFooterButtons({ mode, index, count })}
          className={classes.footer}
          fabClear={classes.fabClear}
          actions={actions}
          submitLabel={submitLabel}
          submittingLabel={submittingLabel}
          submitting={submitting}
          submitDisabled={submitDisabled}
          nextDisabled={nextDisabled}
          describedBy={submitDescribedBy}
          onBack={() => open(previousStepIndex(index, count))}
          onNext={nav.goNext}
          onSubmitClick={handleSubmitClick}
        />
      </div>
    </Ctx.Provider>
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
