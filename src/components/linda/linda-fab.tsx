"use client";

import { useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { lindaFabVisible } from "@/lib/linda";
import { useLindaStore } from "@/store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LindaGate, useLindaAvailable } from "./linda-gate";
import { LINDA_FAB_ID } from "./use-linda-panel-focus";

/**
 * The floating "Ask Linda" button, bottom right on every page but /linda. It
 * opens the panel, and hides while the panel or the expanded chat is open;
 * focus comes back to it when Linda closes. Nothing at all where Linda is off
 * or the user lacks `linda:use`.
 */
export function LindaFab() {
  return (
    <LindaGate>
      <LindaFabButton />
    </LindaGate>
  );
}

function LindaFabButton() {
  const pathname = usePathname();
  const open = useLindaStore((s) => s.open);
  const expanded = useLindaStore((s) => s.expanded);
  const openPanel = useLindaStore((s) => s.openPanel);
  const visible = lindaFabVisible({ available: useLindaAvailable(), pathname, open, expanded });

  // While the button shows, the shell carries `data-linda-fab`, so pinned
  // bottom-right controls and the last rows of scroll boxes keep clear of it
  // (globals.css).
  useEffect(() => {
    if (!visible) return;
    const shell = document.querySelector<HTMLElement>("[data-app-shell]");
    shell?.setAttribute("data-linda-fab", "");
    return () => shell?.removeAttribute("data-linda-fab");
  }, [visible]);

  if (!visible) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          id={LINDA_FAB_ID}
          render={
            // Above the page, below dialogs (z-50). 48 px, 56 px on touch screens and phones.
            <button
              type="button"
              aria-label="Ask Linda"
              aria-controls="linda-panel"
              aria-expanded={false}
              onClick={openPanel}
              className="fixed right-4 bottom-4 z-40 size-12 overflow-hidden rounded-full bg-background shadow-lg ring-4 ring-brand-orange/25 outline-none transition-[box-shadow,transform] hover:scale-105 hover:ring-brand-orange/40 focus-visible:ring-ring/70 motion-reduce:transition-none motion-reduce:hover:scale-100 max-md:size-14 pointer-coarse:size-14 print:hidden"
            />
          }
        >
          <Image
            src="/linda/linda-face-128.webp"
            alt=""
            width={128}
            height={128}
            unoptimized
            loading="eager"
            draggable={false}
            className="size-full select-none rounded-full object-cover"
          />
        </TooltipTrigger>
        <TooltipContent side="top" align="end">Ask Linda</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
