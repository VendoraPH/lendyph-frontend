/**
 * Class lists for pages that fit the screen. The components in
 * `components/common/page-fill.tsx` apply them; they live here so they can be
 * tested and reused on elements that aren't those components (a `Card`, a
 * `CardContent`, a `TabsContent`).
 *
 * Every height and overflow rule sits behind the `fit:` variant (globals.css:
 * at least 1024 px wide and 640 px tall). Below it a page scrolls exactly as it
 * did before, so phones and short windows are unaffected.
 */

/** The table pieces a scroll box pins: headings to the top, totals to the bottom. */
const STICKY_TABLE = [
  // The table's own wrapper scrolls sideways and would become the sticky
  // headings' scroll container; for the box's own table (its direct child, the
  // list pattern) the box does that job. A table nested deeper, e.g. inside a
  // card in a stacked box, keeps its wrapper's sideways scroll: a card hides
  // overflow, so un-clipping it there would cut a wide table off.
  "[&>[data-slot=table-container]]:overflow-visible",
  "[&_thead_th]:sticky",
  "[&_thead_th]:top-0",
  "[&_thead_th]:z-10",
  "[&_thead_th]:bg-card",
  // Row borders don't travel with sticky cells, so the line under the
  // headings is drawn on the cells themselves. The upward shadow in the card
  // colour covers the sliver of the scrolled-away row that shows above the
  // headings when the box starts at a fractional y.
  "[&_thead_th]:shadow-[inset_0_-1px_0_var(--border),0_-2px_0_var(--card)]",
  "[&_tfoot_td]:sticky",
  "[&_tfoot_td]:bottom-0",
  "[&_tfoot_td]:z-10",
  "[&_tfoot_td]:bg-card",
  "[&_tfoot_td]:shadow-[inset_0_1px_0_var(--border),0_2px_0_var(--card)]",
  "[&_tfoot_th]:sticky",
  "[&_tfoot_th]:bottom-0",
  "[&_tfoot_th]:z-10",
  "[&_tfoot_th]:bg-card",
  // A totals row kept in the body: <TableRow data-total>.
  "[&_tr[data-total]>*]:sticky",
  "[&_tr[data-total]>*]:bottom-0",
  "[&_tr[data-total]>*]:z-10",
  "[&_tr[data-total]>*]:bg-card",
].join(" ");

export const FIT_CLASSES = {
  /** The page root (replaces `space-y-6`): a column that takes the main area's height at fit. */
  page: "flex flex-col gap-6 fit:h-full fit:min-h-0",
  /** Takes the height left over in its column and is a column itself. */
  section: "flex flex-col fit:flex-1 fit:min-h-0",
  /** A loader that fills its page (as the page root or inside PageFill) instead of `min-h-[calc(100vh-…)]`. */
  loader: "flex min-h-[50dvh] items-center justify-center fit:h-full fit:min-h-0 fit:flex-1",
} as const;

/**
 * The scroll region's classes.
 *
 * - Default: at fit it takes the height left in its column and scrolls both
 *   ways; below fit it is a plain block that only scrolls sideways (wide
 *   tables), and the page scrolls as before.
 * - `always`: scrolls at every size; used for the expanded dialog's body. Any
 *   scroll box inside it hands it the scrolling, so headings pin to the dialog
 *   on a phone too.
 */
export function scrollBoxClass({ always = false }: { always?: boolean } = {}): string {
  const frame = always
    ? "flex flex-1 min-h-0 min-w-0 flex-col overflow-auto [&_[data-slot=scroll-box]]:overflow-visible"
    : "min-w-0 overflow-x-auto fit:flex-1 fit:min-h-0 fit:overflow-auto";
  return `${frame} ${STICKY_TABLE}`;
}
