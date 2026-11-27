"use client";

import { useEffect, useState } from "react";
import { isCalendarDate } from "@/lib/calendar-date";

/**
 * A service call answering the next number of one cash reference series, for
 * a record dated `date` (today when left out).
 */
export type CashReferenceFetcher = (date?: string) => Promise<{ reference_number?: string | null } | null | undefined>;

/** A preview as fetched: for which save count and which date (null: today). */
export interface LoadedCashPreview {
  key: number;
  date: string | null;
  value: string | null;
}

/**
 * The preview the field shows: only one fetched for this save count and this
 * date, so a stale number never shows while the next one loads.
 */
export function shownCashPreview(
  loaded: LoadedCashPreview | null,
  active: boolean,
  refreshKey: number,
  date: string | null,
): string | null {
  return active && loaded !== null && loaded.key === refreshKey && loaded.date === date ? loaded.value : null;
}

/**
 * The server's next cash reference number while a Cash form is open, or null
 * while loading or when the server has none (404/501 before the backend
 * lands). Bump `refreshKey` after a save so the preview moves on. `date` is
 * the date the record will carry: the number belongs to that date's year, so
 * the preview is fetched again when it changes (a date not yet whole asks for
 * today's). It is only a preview: the server assigns the real number when the
 * record saves. Pass a stable `fetcher` (a service method, not an inline
 * arrow).
 */
export function useCashReferencePreview(
  fetcher: CashReferenceFetcher,
  active: boolean,
  refreshKey: number,
  date: string | null = null,
): string | null {
  const [loaded, setLoaded] = useState<LoadedCashPreview | null>(null);
  const forDate = isCalendarDate(date) ? date : null;

  useEffect(() => {
    if (!active) return;
    let live = true;
    fetcher(forDate ?? undefined)
      .then((data) => {
        if (live) setLoaded({ key: refreshKey, date: forDate, value: data?.reference_number ?? null });
      })
      .catch(() => {
        if (live) setLoaded({ key: refreshKey, date: forDate, value: null });
      });
    return () => {
      live = false;
    };
  }, [fetcher, active, refreshKey, forDate]);

  return shownCashPreview(loaded, active, refreshKey, forDate);
}
