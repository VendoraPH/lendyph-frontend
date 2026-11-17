"use client";

/**
 * `FormStepper`'s step rail, a `nav` labelled "Form steps":
 *
 * - wide: numbered steps with titles, a check on finished ones and
 *   `aria-current="step"` on the open one; a step that can't be opened yet is
 *   disabled;
 * - narrow: "Step 2 of 4 · Contact" with a thin bar. In `edit` mode that line
 *   is a menu of every step, so an editor can jump to any step on a phone too
 *   (`stepMenuOptions`). A native select, so phones show their own picker.
 *
 * Private to `form-stepper.tsx`.
 */

import { Check } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  stepMenuOptions,
  stepProgressPercent,
  stepProgressText,
  type FormStepDef,
  type FormStepperMode,
} from "@/lib/form-stepper";
import { cn } from "@/lib/utils";

export function StepRail({
  compactClassName,
  fullClassName,
  mode,
  steps,
  index,
  passed,
  reachable,
  onSelect,
}: {
  compactClassName: string;
  fullClassName: string;
  mode: FormStepperMode;
  steps: readonly FormStepDef[];
  index: number;
  passed: readonly boolean[];
  reachable: (i: number) => boolean;
  onSelect: (i: number) => void;
}) {
  const count = steps.length;
  const menu = stepMenuOptions(steps, mode);
  return (
    <nav aria-label="Form steps" className="shrink-0">
      <div className={compactClassName}>
        {menu ? (
          <NativeSelect
            aria-label="Go to step"
            value={steps[index].id}
            onChange={(e) => onSelect(steps.findIndex((s) => s.id === e.target.value))}
            disabled={!reachable(index)}
            className="w-full"
          >
            {menu.map((o) => (
              <NativeSelectOption key={o.id} value={o.id}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <p className="text-sm font-medium">{stepProgressText(index, count, steps[index].title)}</p>
        )}
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
