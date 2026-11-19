/**
 * Wide transfer tables at 1024 px: the Actions column stays pinned to the
 * right edge while the rest scrolls sideways, and the sideways scrollbar stays
 * drawn (the system's overlay scrollbars hide until scrolled), as AMLA Alerts
 * does.
 */

/** A scroll box's own scrollbars, always drawn. */
export const VISIBLE_SCROLLBAR =
  "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-muted/40";

/** The same, for tables that scroll sideways in their own wrapper (inside a box that pins nothing). */
export const NESTED_VISIBLE_SCROLLBAR =
  "[&_[data-slot=table-container]::-webkit-scrollbar]:h-2 [&_[data-slot=table-container]::-webkit-scrollbar-thumb]:rounded-full [&_[data-slot=table-container]::-webkit-scrollbar-thumb]:bg-border [&_[data-slot=table-container]::-webkit-scrollbar-track]:bg-muted/40";

/** The Actions cells: pinned right, on the card's colour, with a left rule. */
export const STICKY_ACTIONS_CELL = "sticky right-0 z-[5] bg-card shadow-[inset_1px_0_0_var(--border)]";

/** The Actions heading: also above the pinned headings and the pinned cells. */
export const STICKY_ACTIONS_HEAD = "sticky right-0 z-20! bg-card shadow-[inset_1px_0_0_var(--border)]";
