import { cn } from "@/lib/utils";

/**
 * Linda's panel layout (`LindaPanel`).
 *
 * - Phones: the open panel covers the screen (a modal dialog); closed, it's
 *   gone.
 * - From `md`: a side pop-up fixed over the page's right edge, full height. It
 *   slides in and out, and it never takes a width in the page's row, so the
 *   page and the sidebar don't move when Linda opens (Arvin, 2026-11-17).
 *   Closed, it's off screen and invisible, so it can't be seen or reached.
 */
export function lindaPanelClass(open: boolean): string {
  return cn(
    "flex-col overflow-hidden bg-background outline-none",
    open ? "fixed inset-0 z-50 flex" : "hidden",
    "md:fixed md:inset-y-0 md:right-0 md:left-auto md:z-50 md:flex md:w-[min(28rem,90vw)] md:border-l md:border-border md:shadow-2xl md:duration-300 md:ease-in-out",
    // Visibility changes at once on open, so the composer can take focus as the
    // panel slides in, and only after the slide on close.
    open
      ? "md:visible md:translate-x-0 md:transition-transform"
      : "md:invisible md:translate-x-full md:transition-[transform,visibility]",
  );
}
