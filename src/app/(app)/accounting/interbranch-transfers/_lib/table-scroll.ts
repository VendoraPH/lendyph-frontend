/**
 * Wide transfer tables at 1024 px: the Actions column stays pinned to the
 * right edge while the rest scrolls sideways. The scrollbar classes are the
 * shared `VISIBLE_SCROLLBAR` (`@/components/amla/visible-scrollbar`).
 */

/**
 * Hands each table's sideways scroll to the box around it (the tables' own
 * wrappers stop scrolling), so the one focusable region scrolls both ways and
 * the arrow keys move it sideways.
 */
export const TABLES_SCROLL_WITH_BOX = "[&_[data-slot=table-container]]:overflow-visible";

/** The Actions cells: pinned right, on the card's colour, with a left rule. */
export const STICKY_ACTIONS_CELL = "sticky right-0 z-[5] bg-card shadow-[inset_1px_0_0_var(--border)]";

/** The Actions heading: also above the pinned headings and the pinned cells. */
export const STICKY_ACTIONS_HEAD = "sticky right-0 z-20! bg-card shadow-[inset_1px_0_0_var(--border)]";
