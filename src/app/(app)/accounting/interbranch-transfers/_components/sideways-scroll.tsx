"use client";

import type { ReactNode } from "react";
import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { cn } from "@/lib/utils";
import { TABLES_SCROLL_WITH_BOX } from "../_lib/table-scroll";

/**
 * A wide table's own sideways scroll, as a focusable, named region, so the
 * arrow keys move it while the headings and notes around it stay in view.
 * The table's wrapper stops scrolling, so this is the one element that does,
 * and the pinned Actions column sticks to its right edge.
 */
export function SidewaysScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn(
        "overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        VISIBLE_SCROLLBAR,
        TABLES_SCROLL_WITH_BOX,
      )}
    >
      {children}
    </div>
  );
}
