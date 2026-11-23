import { SkipForward } from "lucide-react";

/**
 * A step the loan's chain left out by its minimum principal, in its place in
 * the approval tracker: muted and dashed, never numbered, so the numbers and
 * "Step N of M" count only the steps the round kept. The server's sentence
 * shows on hover here and in full under the tracker.
 */
export function LeftOutStepChip({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[68px]" title={description}>
      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 border border-dashed border-muted-foreground/40 bg-background text-muted-foreground">
        <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <span className="text-[10px] text-center leading-tight font-medium text-muted-foreground">
        {name}
        <span className="block font-normal">Skipped</span>
      </span>
    </div>
  );
}
