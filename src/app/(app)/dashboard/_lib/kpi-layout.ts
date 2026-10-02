/**
 * Class names for the dashboard page and its KPI row.
 *
 * Linda's side panel narrows the page, and at 1024px five cards across clip
 * their figures ("₱130K" read "₱130I"). While the panel is open, the row drops
 * to three across whenever the page itself is narrower than 43rem; at wider
 * widths it stays at five.
 *
 * Anywhere else, including every deployment with Linda turned off, these are
 * exactly the classes the dashboard has always rendered.
 */
export function dashboardKpiClasses({
  lindaEnabled,
  lindaOpen,
}: {
  lindaEnabled: boolean;
  lindaOpen: boolean;
}): { page: string; grid: string } {
  if (lindaEnabled && lindaOpen) {
    return {
      page: "@container/dashboard space-y-6",
      grid: "grid grid-cols-2 lg:grid-cols-5 lg:@max-[43rem]/dashboard:grid-cols-3 gap-4",
    };
  }
  return { page: "space-y-6", grid: "grid grid-cols-2 lg:grid-cols-5 gap-4" };
}
