"use client";

import { useId, type ComponentProps } from "react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ActionButtonProps = ComponentProps<typeof PermissionButton> & {
  /**
   * Why the action can't be taken although the role allows it (the maker
   * approving their own request, a closed account), or null when it can.
   * The button is disabled and the reason shows on hover, focus and to
   * screen readers.
   */
  blockedReason?: string | null;
};

/** A `PermissionButton` that also says why it is disabled for a reason other than the role. */
export function ActionButton({ blockedReason, wrapperClassName, className, children, ...props }: ActionButtonProps) {
  const { can } = usePermission();
  const reasonId = useId();

  if (!blockedReason || !can(props.permission)) {
    return (
      <PermissionButton wrapperClassName={wrapperClassName} className={className} {...props}>
        {children}
      </PermissionButton>
    );
  }

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
          <Button
            type="button"
            variant={props.variant}
            size={props.size}
            className={cn("opacity-50", className)}
            disabled
            aria-describedby={reasonId}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{blockedReason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {blockedReason}
      </span>
    </TooltipProvider>
  );
}
