"use client";

import { Sparkles } from "lucide-react";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";
import { useLindaStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** The header button that opens and closes Linda. Hidden where Linda is off. */
export function LindaTrigger() {
  const open = useLindaStore((s) => s.open);
  const togglePanel = useLindaStore((s) => s.togglePanel);

  if (!env.features.linda) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={open}
              aria-controls="linda-panel"
              onClick={togglePanel}
              className={cn(
                "rounded-full text-muted-foreground hover:bg-muted/50",
                open && "bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/15",
              )}
            />
          }
        >
          <Sparkles className="h-4 w-4" />
          <span className="sr-only">Ask Linda</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Ask Linda</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
