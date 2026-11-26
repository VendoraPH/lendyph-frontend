// The Audit Detail drawer's field grid. A grid cell's minimum width is its
// content by default, and the Badge is one fit-content line, so a long action
// label ran over the Module beside it (finish run round 7, BC15). Each cell
// may shrink to its column, and the Action badge wraps inside it.

/** A field in the drawer's two-column grid. */
export const AUDIT_DETAIL_CELL = "min-w-0 space-y-1";

/** The Action badge: as wide as its column at most, wrapping onto more lines. */
export const AUDIT_DETAIL_ACTION_BADGE = "h-auto max-w-full justify-start whitespace-normal break-words text-left";
