"use client";

/**
 * `FormStepper`'s footer: the form's own actions (Cancel) on the left, then
 * Back, Next and the form's submit button, as `stepFooterButtons` decides.
 * Private to `form-stepper.tsx`.
 */

import type { MouseEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { StepFooterButtons } from "@/lib/form-stepper";

const PRIMARY = "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark";

export function StepFooter({
  buttons,
  className,
  fabClear,
  actions,
  submitLabel,
  submittingLabel,
  submitting,
  submitDisabled,
  nextDisabled,
  describedBy,
  onBack,
  onNext,
  onSubmitClick,
}: {
  buttons: StepFooterButtons;
  className: string;
  /** Carries `data-fab-clear`, so Linda's floating button never covers it. */
  fabClear: boolean;
  actions?: ReactNode;
  submitLabel: ReactNode;
  submittingLabel?: ReactNode;
  submitting: boolean;
  submitDisabled: boolean;
  nextDisabled: boolean;
  /** `aria-describedby` for Next and the submit button: the reason one is disabled. */
  describedBy?: string;
  onBack: () => void;
  onNext: () => void;
  onSubmitClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const nextIsPrimary = buttons.primary === "next";
  return (
    <div data-fab-clear={fabClear ? "" : undefined} className={className}>
      {actions ? <div className="mr-auto flex items-center gap-2">{actions}</div> : null}
      {buttons.back ? (
        <Button key="back" type="button" variant="outline" onClick={onBack} disabled={submitting}>
          <ChevronLeft aria-hidden="true" />
          Back
        </Button>
      ) : null}
      {/* Separate slots and keys: a clicked Next must never turn into the submit button in place. */}
      {buttons.next ? (
        <Button
          key="next"
          type="button"
          variant={nextIsPrimary ? "default" : "outline"}
          onClick={onNext}
          disabled={submitting || nextDisabled}
          aria-describedby={describedBy}
          className={nextIsPrimary ? PRIMARY : undefined}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      ) : null}
      {buttons.submit ? (
        <Button
          key="submit"
          type="submit"
          onClick={onSubmitClick}
          disabled={submitting || submitDisabled}
          aria-describedby={describedBy}
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
  );
}
