"use client";

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
  };

const DEFAULT_TOOLTIP = "Your role doesn't have permission to do this";

export function PermissionButton({
  permission,
  tooltip = DEFAULT_TOOLTIP,
  children,
  className,
  disabled,
  ...props
}: PermissionButtonProps) {
  const { can } = usePermission();
  const allowed = can(permission);

  if (allowed) {
    return (
      <Button className={className} disabled={disabled} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className={cn("opacity-50", className)}
              disabled
              {...props}
            />
          }
        >
          <LockKeyhole className="size-3.5" />
          {children}
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
