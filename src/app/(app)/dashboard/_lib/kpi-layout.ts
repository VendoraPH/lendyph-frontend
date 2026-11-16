/** The page root's own classes: the size container the rows below query. */
export const DASHBOARD_PAGE_CLASS = "@container/dashboard";

/**
 * Class names for the dashboard page, its KPI row and its two cards.
 *
 * The page is a size container (`@container/dashboard`), so the layout
 * follows the page's own width, which Linda's side panel narrows:
 * - KPI row: at 1024px five cards across clip their figures ("₱130K" read
 *   "₱130I") while the panel is open, so the row drops to three across
 *   whenever the page is narrower than 43rem. Otherwise it stays at five.
 * - Cards: daily dues and Recent Transactions sit side by side once the page
 *   is 56rem wide and stack below that. At fit (globals.css) they share the
 *   height left under the KPI row and scroll inside; below fit the page
 *   scrolls as it always has.
 */
export function dashboardKpiClasses({
  lindaEnabled,
  lindaOpen,
}: {
  lindaEnabled: boolean;
  lindaOpen: boolean;
}): { page: string; grid: string; columns: string } {
  const columns =
    "grid gap-4 @min-[56rem]/dashboard:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] fit:flex-1 fit:min-h-0 fit:auto-rows-[minmax(0,1fr)]";
  const grid =
    lindaEnabled && lindaOpen
      ? "grid grid-cols-2 lg:grid-cols-5 lg:@max-[43rem]/dashboard:grid-cols-3 gap-4"
      : "grid grid-cols-2 lg:grid-cols-5 gap-4";
  return { page: DASHBOARD_PAGE_CLASS, grid, columns };
}
