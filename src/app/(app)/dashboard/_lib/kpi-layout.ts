import type { Icon3DName } from "@/lib/icons-3d";

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

/** The dashboard's figure cards, by key. */
export type KpiKey = "portfolio" | "active_loans" | "collected" | "overdue" | "share_capital";

/**
 * Each figure card's 3D icon, drawn at the size of the old 28px circle, so the
 * cards stay level and fit as before.
 */
export const KPI_ICONS_3D: Readonly<Record<KpiKey, Icon3DName>> = {
  portfolio: "icon-wallet",
  active_loans: "empty-loans",
  collected: "icon-coin",
  overdue: "icon-alert",
  share_capital: "empty-share-capital",
};
