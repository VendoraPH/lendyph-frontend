"use client";

import { useId } from "react";
import { LockKeyhole } from "lucide-react";

import { usePermission } from "@/hooks";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Permission } from "@/types";
import type { VariantProps } from "class-variance-authority";
import type { Button as ButtonPrimitive } from "@base-ui/react/button";

type PermissionButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    permission: Permission;
    tooltip?: string;
    /**
     * Layout classes for the focusable wrapper a denied button sits in (for
     * example `flex-1` or `shrink-0` when the button is a flex child). Only
     * used while the permission is missing.
     */
    wrapperClassName?: string;
  };

const DEFAULT_TOOLTIP = "Your role doesn't have permission to do this";

export function PermissionButton({
  permission,
  tooltip = DEFAULT_TOOLTIP,
  wrapperClassName,
  children,
  className,
  disabled,
  ...props
}: PermissionButtonProps) {
  const { can } = usePermission();
  const reasonId = useId();
  const allowed = can(permission);

  if (allowed) {
    return (
      <Button className={className} disabled={disabled} {...props}>
        {children}
      </Button>
    );
  }

  // A disabled button takes no pointer events and can't be focused, so it
  // can't open its own tooltip. The tooltip sits on a focusable wrapper
  // instead (hover and Tab both reach it), and the button names the reason
  // through `aria-describedby` for screen readers.
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
                wrapperClassName
              )}
            />
          }
        >
          <Button
            className={cn("opacity-50", className)}
            {...props}
            disabled
            aria-describedby={reasonId}
          >
            <LockKeyhole className="size-3.5" />
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {tooltip}
      </span>
    </TooltipProvider>
  );
}
