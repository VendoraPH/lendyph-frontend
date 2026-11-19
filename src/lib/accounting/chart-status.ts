// Where the organisation's chart of accounts stands, for the screens that
// pick accounts from it. Dependency-free, so it runs under `tsx --test`.

/**
 * - `saved`: the organisation's own chart, safe to post against.
 * - `not_set_up`: the server answered with no accounts; nobody has saved a chart.
 * - `no_access`: the caller lacks `chart_of_accounts:view`, so it wasn't read.
 * - `unavailable`: the request failed (or the endpoint is missing), which says
 *   nothing about whether a chart exists.
 * - `loading`: not answered yet.
 */
export type ChartStatus = "loading" | "saved" | "not_set_up" | "no_access" | "unavailable";

export interface ChartStatusInput {
  canView: boolean;
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  /** How many accounts the server sent; null before it answered. */
  rows: number | null;
}

export function chartStatus({ canView, loading, unavailable, error, rows }: ChartStatusInput): ChartStatus {
  if (!canView) return "no_access";
  if (loading) return "loading";
  if (unavailable || error !== null || rows === null) return "unavailable";
  return rows === 0 ? "not_set_up" : "saved";
}

/** Where the chart is set up (the menu's Chart of Accounts). */
export const CHART_OF_ACCOUNTS_HREF = "/accounting/chart-of-accounts";

export const CHART_NOT_SET_UP_TITLE = "Set up the chart of accounts first";

/** Why the screen shows the default template instead of the saved chart; null when it doesn't. */
export function chartTemplateNotice(status: ChartStatus): string | null {
  switch (status) {
    case "not_set_up":
      return "The chart of accounts hasn't been set up yet.";
    case "no_access":
      return "The chart of accounts can't be read without the Chart of Accounts: View permission.";
    case "unavailable":
      return "The chart of accounts couldn't be loaded. Reload the page to try again.";
    default:
      return null;
  }
}
