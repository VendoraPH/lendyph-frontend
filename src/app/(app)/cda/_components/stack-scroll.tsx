import type { ComponentProps } from "react";
import { ScrollBox } from "@/components/common/page-fill";
import { cn } from "@/lib/utils";

/**
 * A CDA page's stack of cards (a report, its registers, a long form) in one
 * scroll box: at fit it takes the height left under the page header and
 * scrolls inside; below fit it is a plain block and the page scrolls as
 * before (the tables in it keep their own sideways scroll). The 4px inset
 * keeps the cards' outlines and the fields' focus rings clear of the box's
 * edge without moving anything.
 */
export function StackScroll({ className, ...props }: ComponentProps<typeof ScrollBox>) {
  return <ScrollBox className={cn("space-y-6 overflow-x-visible fit:-m-1 fit:p-1", className)} {...props} />;
}
