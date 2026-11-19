/**
 * Class names for the executive dashboard's layout. Pure, so the fit rules
 * are tested (`executive-layout.test.ts`).
 *
 * At fit (1024 x 640 and up) only the header and the filter bar keep their
 * height; the KPI cards and the sections share one `ScrollBox` that takes the
 * rest. Every grid is a shrinkable column at phone width (`grid-cols-1` is
 * `minmax(0, 1fr)`), so a chart or a wide table never pushes past its card.
 */
export const EXECUTIVE_LAYOUT = {
  /** The page title and the filter bar. */
  pinned: "shrink-0",
  /**
   * The scroll box itself. Positioned, so the absolute screen-reader tables,
   * captions and labels inside it attach to it, not to the page, which they
   * would otherwise stretch (the page scrolled the header away).
   */
  scrollBox: "relative",
  /** Inside the scroll box: the KPI cards, then the sections. */
  scrollBody: "flex min-w-0 flex-col gap-4",
  kpiGrid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
  /** The sections beside the attention panel. */
  columns: "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]",
  /** Two charts or blocks side by side from lg. */
  twoUp: "grid grid-cols-1 gap-4 lg:grid-cols-2",
  /** A grid cell that may shrink below its content's width. */
  cell: "min-w-0",
  /** Figure tiles: as many as fit, each wide enough for a full ₱ figure with two decimals. */
  tiles: "grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2",
} as const;
