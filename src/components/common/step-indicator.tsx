/**
 * Numbered step rail for a multi-step flow.
 *
 * Promoted here from `app/(public)/register/_components/` when the data-import
 * wizard needed the same rail. Moved rather than copied, and the body below is
 * byte-for-byte what the registration flow has been shipping.
 *
 * The reason it is a move: the progress-fill width is an empirically-derived
 * expression, not a formula anyone can re-derive from the layout. It exists to
 * make the fill stop under the centre of the last completed dot given that the
 * first and last dots are inset by half a dot-width, and a second copy would
 * drift the moment either flow nudged a size. Do not "simplify" it without a
 * screenshot of every step count it has to serve (registration renders 5-7
 * depending on marital status; data-import renders 5).
 *
 * Imported directly rather than via `@/components/common` — that barrel is not
 * tree-shaken and pulls its whole named module into the shared chunk of the ~43
 * routes that import `RouteGuard` from it. See the note at the foot of
 * `components/common/index.ts`.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  labels: string[];
}

export function StepIndicator({ current, labels }: StepIndicatorProps) {
  const total = labels.length;

  return (
    <div className="relative flex items-start justify-between max-w-md mx-auto mb-5">
      {/* background connector */}
      <div className="absolute top-[18px] left-9 right-9 h-0.5 bg-border" />
      {/* progress fill */}
      <div
        className="absolute top-[18px] left-9 h-0.5 bg-brand-orange transition-all duration-300"
        style={{
          width:
            total > 1
              ? `${((current - 1) / (total - 1)) * 100 * ((total - 1) / total) * (total / (total - 1 + 1/total))}%`
              : "0%",
          maxWidth: `calc(100% - 72px)`,
        }}
      />
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        return (
          <div key={stepNum} className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={cn(
                "h-9 w-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
                isActive &&
                  "border-brand-orange bg-brand-orange text-white shadow-[0_0_0_4px_rgba(249,115,22,0.15)]",
                isDone && "border-brand-orange bg-brand-orange text-white",
                !isActive &&
                  !isDone &&
                  "border-border bg-background text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : stepNum}
            </div>
            <span
              className={cn(
                "text-xs font-medium text-center whitespace-nowrap",
                isActive || isDone
                  ? "text-brand-orange"
                  : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
