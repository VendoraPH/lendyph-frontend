"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One summary figure as the server sent it. When the server withholds it the
 * value reads a dash, and `hiddenReason` says why on hover, on focus and to
 * screen readers.
 */
export function FigureCard({
  label,
  value,
  hiddenReason = null,
}: {
  label: string;
  value: string;
  hiddenReason?: string | null;
}) {
  const reasonId = useId();

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-2xl font-semibold tabular-nums" aria-describedby={hiddenReason ? reasonId : undefined}>
          {value}
        </p>
        {hiddenReason && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Why ${label} isn't shown`}
                    aria-describedby={reasonId}
                    className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <Info className="h-4 w-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="top">{hiddenReason}</TooltipContent>
            </Tooltip>
            <span id={reasonId} className="sr-only">
              {hiddenReason}
            </span>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
