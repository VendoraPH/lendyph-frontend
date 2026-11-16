/**
 * Pictures for the empty, error, no-access and sign-in screens, by slot.
 *
 * Each value is a path the app serves from `public/illustrations/`, or null.
 * A null slot renders the screen exactly as it was before pictures existed,
 * so a deployment never shows a broken image while a picture is missing.
 * Fill a slot by dropping the file into `public/illustrations/` and setting
 * its path here; the screens pick it up with no other change.
 */
export const ILLUSTRATION_NAMES = [
  "signIn",
  "portalSignIn",
  "empty",
  "noResults",
  "allCaughtUp",
  "error",
  "notConnected",
  "noAccess",
  "notFound",
  "pickReport",
] as const;

export type IllustrationName = (typeof ILLUSTRATION_NAMES)[number];

export const ILLUSTRATIONS: Readonly<Record<IllustrationName, string | null>> = {
  /** Staff sign-in, the gradient half. */
  signIn: null,
  /** Member-portal sign-in, above the card on wide screens. */
  portalSignIn: null,
  /** "Nothing yet": a list or report with no rows. */
  empty: null,
  /** A search or filter that matched nothing. */
  noResults: null,
  /** Nothing overdue or waiting. */
  allCaughtUp: null,
  /** Something went wrong (DataState error, app error page). */
  error: null,
  /** A module whose backend isn't connected yet. */
  notConnected: null,
  /** AccessDenied. */
  noAccess: null,
  /** The app-level not-found page. */
  notFound: null,
  /** The reports page before a report is picked. */
  pickReport: null,
};

/** The picture for a slot, or null when the slot is empty. */
export function illustrationSrc(name: IllustrationName): string | null {
  return ILLUSTRATIONS[name];
}
