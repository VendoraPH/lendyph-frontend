"use client";

import { useId } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { VariantProps } from "class-variance-authority";
import type { JournalActionState } from "../_lib/journal-actions";

interface JournalActionButtonProps extends VariantProps<typeof buttonVariants> {
  state: JournalActionState;
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * A journal action that is offered. When it can't be used right now it is
 * disabled, and its reason shows on hover and focus and is read to screen
 * readers, as `PermissionButton` does for a missing permission.
 */
export function JournalActionButton({ state, onClick, children, ...variant }: JournalActionButtonProps) {
  const reasonId = useId();

  if (state.disabledReason === null) {
    return (
      <Button {...variant} onClick={onClick}>
        {children}
      </Button>
    );
  }

  // A disabled button can't be focused or hovered, so the reason sits on a
  // focusable wrapper.
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
          <Button {...variant} disabled aria-describedby={reasonId}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{state.disabledReason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {state.disabledReason}
      </span>
    </TooltipProvider>
  );
}
