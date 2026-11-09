"use client";

import { useId, type ComponentProps } from "react";
import { HelpCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ReasonButtonProps = ComponentProps<typeof Button> & {
  /** Why the button can't be used. Null leaves it enabled. */
  reason: string | null;
};

/**
 * A button that, when it can't be used, stays visible but disabled with its
 * reason on a tooltip, as `PermissionButton` does for one permission. Here the
 * reason can be any rule (two permissions, the chart being unavailable).
 */
export function ReasonButton({ reason, children, className, ...props }: ReasonButtonProps) {
  const reasonId = useId();

  if (reason === null) {
    return (
      <Button className={className} {...props}>
        {children}
      </Button>
    );
  }

  // A disabled button can't be focused or hovered, so the tooltip sits on a
  // focusable wrapper and the button names the reason for screen readers.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-describedby={reasonId}
              className="inline-flex cursor-not-allowed rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <Button className={cn("opacity-50", className)} {...props} disabled aria-describedby={reasonId}>
            <LockKeyhole className="size-3.5" />
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </TooltipProvider>
  );
}

/** Stands in for an action that isn't offered on this line, saying why on a tooltip. */
export function HiddenActionHint({ label, reason }: { label: string; reason: string }) {
  const reasonId = useId();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-describedby={reasonId}
              className="inline-flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <HelpCircle className="size-3.5" />
          {`${label} isn't offered`}
        </TooltipTrigger>
        <TooltipContent side="top">{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </TooltipProvider>
  );
}
