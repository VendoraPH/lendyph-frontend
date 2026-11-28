// The dates a live CIC view may be built as of. The server accepts today, or a
// month's last day within the last 92 days (any other date answers 422); a
// capture can be read at any date. Pure, so it is unit-tested.

/** How far back a month end may be, as the server allows it. */
export const LIVE_MONTH_END_DAYS = 92;

const DAY_MS = 86_400_000;

function utcOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isoOf(ms: number): string {
  const date = new Date(ms);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * Today (`todayIso`, Manila's date), then each month's last day before it
 * within the last 92 days, newest first. Today is listed once even when it is
 * itself a month end.
 */
export function liveReferenceDates(todayIso: string): string[] {
  const today = utcOf(todayIso);
  const earliest = today - LIVE_MONTH_END_DAYS * DAY_MS;
  const dates = [todayIso];
  const [y, m] = todayIso.split("-").map(Number);
  // Day 0 of a month is the last day of the month before it.
  for (let back = 0; ; back++) {
    const monthEnd = Date.UTC(y, m - 1 - back, 0);
    if (monthEnd < earliest) break;
    if (monthEnd < today) dates.push(isoOf(monthEnd));
  }
  return dates;
}
