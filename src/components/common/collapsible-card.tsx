"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  title: ReactNode;
  /** Sits left of the title — usually a lucide icon. */
  icon?: ReactNode;
  /**
   * Badges or buttons pinned to the right of the header. They live outside the
   * toggle, so clicking one does not open or close the card (and a real button
   * never ends up nested inside the trigger button).
   */
  headerExtra?: ReactNode;
  /** Sections start open; pass false where the content is rarely wanted. */
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * A Card whose body can collapse behind its header. Opens expanded, so a page
 * of these reads top to bottom on arrival and the header is there to hide a
 * section you are done with. Deliberately uncontrolled — screens with a dozen
 * of these would otherwise carry a dozen open/close useStates nothing reads.
 */
export function CollapsibleCard({
  title,
  icon,
  headerExtra,
  defaultOpen = true,
  className,
  contentClassName,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={className}>
        <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex-1 min-w-0 text-left group/trigger">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {icon}
                {title}
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
              </CardTitle>
            </CollapsibleTrigger>
            {headerExtra ? (
              <div className="flex shrink-0 items-center gap-2">
                {headerExtra}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className={cn(contentClassName)}>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
