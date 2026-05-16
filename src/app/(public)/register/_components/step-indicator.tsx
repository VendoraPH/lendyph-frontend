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
