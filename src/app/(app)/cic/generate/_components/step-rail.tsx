import { cn } from "@/lib/utils";
import { GENERATE_STEPS, type GenerateStep } from "../_lib/steps";

/** The eight steps, with the current one marked and the finished ones ticked. */
export function StepRail({ step }: { step: GenerateStep }) {
  return (
    <ol className="flex shrink-0 flex-wrap gap-2 text-xs">
      {GENERATE_STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === step ? "step" : undefined}
          className={cn(
            "rounded-full border px-3 py-1",
            i === step && "border-primary bg-primary text-primary-foreground",
            i < step && "text-muted-foreground",
          )}
        >
          {i < step ? "✓ " : `${i + 1}. `}
          {label}
        </li>
      ))}
    </ol>
  );
}
