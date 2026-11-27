import type { CdaReportPart } from "@/types/cda";

/**
 * The parameters a CDA notice link carries (`?year=`, and `&part=` for a
 * mediation half). A link opens the page on them; a choice made by hand then
 * drops the parameter from the address, so it stops winning.
 */

/** The mediation half a link names, or null. */
export function linkedPart(raw: string | null | undefined): Extract<CdaReportPart, "h1" | "h2"> | null {
  return raw === "h1" || raw === "h2" ? raw : null;
}

/** The page's address without `keys`, its other parameters kept. */
export function withoutParams(pathname: string, search: string, keys: readonly string[]): string {
  const params = new URLSearchParams(search);
  for (const key of keys) params.delete(key);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

/**
 * The parameters a year change drops: the link's `?year=`, and a documents
 * list's one-row filter (`subject_type`, `subject_id`), since a row's
 * documents belong to its own year and the new year should show its full
 * list. Others (a mediation half) stay.
 */
const YEAR_SCOPED = ["year", "subject_type", "subject_id"] as const;

/** The address after a year change, or null when it has nothing to drop. */
export function yearChangeAddress(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  if (!YEAR_SCOPED.some((key) => params.has(key))) return null;
  return withoutParams(pathname, search, YEAR_SCOPED);
}
