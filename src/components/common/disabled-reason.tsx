"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Says why a control that isn't a button (a switch, a click-to-edit value) is
 * disabled, as `PermissionButton` does for a button. With no reason the
 * children render as they are.
 *
 * A disabled control can't be focused or hovered, so the reason sits on a
 * focusable wrapper (hover and Tab both reach it) and is read to screen
 * readers through `aria-describedby`. `wrapperClassName` lays the wrapper out
 * where the control needs it, as `PermissionButton`'s does (for example the
 * full width of a menu row).
 */
export function DisabledReason({
  reason,
  wrapperClassName,
  children,
}: {
  reason: string | null;
  wrapperClassName?: string;
  children: React.ReactNode;
}) {
  const reasonId = useId();

  if (reason === null) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-describedby={reasonId}
              className={cn(
                "inline-flex cursor-not-allowed rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                wrapperClassName,
              )}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side="top">{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </TooltipProvider>
  );
}
