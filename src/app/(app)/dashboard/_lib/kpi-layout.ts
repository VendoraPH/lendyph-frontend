/** The page root's own classes: the size container the KPI row queries. */
export const DASHBOARD_PAGE_CLASS = "@container/dashboard";

/**
 * Class names for the dashboard's KPI row and its cards.
 *
 * The page is a size container (`@container/dashboard`), so the row follows
 * the page's own width, which a 1024px screen or Linda's side panel narrows.
 * Five cards across on a wide page; below 52rem, three plus two, since five
 * squeezed the sparklines to slivers and wrapped the premium line 4-5 times.
 * Each card is a size container too (`@container/kpi`), and its sparkline
 * shows only once the card is 14rem wide. Every figure always shows.
 *
 * A card's content sits at the top rather than centred, so a card that adds a
 * line under its figure (Collected's insurance premium) keeps its figure,
 * label and sparkline level with the other cards. Rows share one height
 * (`auto-rows-fr`), so three plus two keeps every card the same size.
 */
export function dashboardKpiClasses(): { grid: string; card: string; content: string; row: string; sparkline: string } {
  return {
    grid: "grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-5 lg:@max-[52rem]/dashboard:grid-cols-3",
    card: "@container/kpi",
    content: "flex h-full flex-col justify-start gap-1",
    // As tall as the sparkline (40px), so the figure is centred the same way
    // whether a card draws one or not (Share Capital has none).
    row: "flex min-h-10 items-center justify-between gap-2",
    sparkline: "hidden shrink-0 @min-[14rem]/kpi:block",
  };
}

/** Inside the expand dialog, the card's 16px inset is dropped, so the body starts at the dialog title's left edge. */
const IN_DIALOG_FLUSH = "in-data-[slot=dialog-content]:mx-0";

/** The card's tabs: in line with the panels under them, on the card and in the dialog. */
export const DUES_TABS_LIST_CLASS = `mx-4 ${IN_DIALOG_FLUSH}`;

/**
 * The ring's size: it follows the window's height (7–11rem), so the ring, its
 * key, its caption and the "Today" list fit the panel at 1366x768 and the ring
 * never clips on a short screen. The nothing-due picture takes the same height.
 */
export const DUES_RING_SIZE_CLASS = "size-[clamp(7rem,20dvh,11rem)]";
export const DUES_EMPTY_PICTURE_CLASS = "max-h-[clamp(7rem,20dvh,11rem)]";

/**
 * The collections ring's panel beside the Daily dues table: the app's usual
 * inner panel (`rounded-lg border p-4`). On a wide card it runs the table
 * panel's height (`@xl:self-stretch`), so both boxes end level, with the ring
 * and the "Today" list at the top (`justify-start`), level with the table's
 * headings; below the list it shows plain space. On a short screen it scrolls
 * inside its own box. No fill, so the empty ring (a muted stroke) stays
 * visible. Its left edge lines up with the tabs above it; on a narrow card it
 * sits above the table, full width.
 */
export const DUES_DONUT_COLUMN_CLASS = `mx-4 flex shrink-0 flex-col items-center justify-start gap-2 rounded-lg border p-4 @xl:mr-0 @xl:w-60 @xl:self-stretch @xl:min-h-0 @xl:overflow-y-auto ${IN_DIALOG_FLUSH}`;

/**
 * The Daily dues and Recent transactions tables' own panels: the ring's inner
 * panel (`rounded-lg border`), so the boxes share one top line with the table's
 * headings at the top of theirs. With only the ring boxed, its top lined up with
 * the table's invisible top edge and still read as out of line. Each sits 16px in
 * from the card's sides; beside the ring, the row's gap spaces the two boxes and
 * the table takes the rest of the width.
 *
 * Each is a wrapper around the table's scroll box that clips its own corners
 * (`overflow-clip`). The expand dialog turns a scroll box's overflow off, so a
 * border on the scroll box itself lost its rounded clip there. Unlike
 * `overflow-hidden`, `overflow-clip` is no scroll container, so the headings still
 * pin to whichever box scrolls: the table's on the page, the dialog's when expanded.
 * Being no scroll container, it also keeps a flex item's `min-width: auto`, so
 * `min-w-0` lets it shrink below its table and the scroll box scrolls sideways.
 */
export const DUES_TABLE_PANEL_CLASS = `mx-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-clip rounded-lg border @xl:ml-0 ${IN_DIALOG_FLUSH}`;
export const TRANSACTIONS_TABLE_PANEL_CLASS = `mx-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-clip rounded-lg border ${IN_DIALOG_FLUSH}`;
