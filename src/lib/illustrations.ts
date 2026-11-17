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
  signIn: "/illustrations/sign-in.webp",
  /** Member-portal sign-in, above the card on wide screens. */
  portalSignIn: "/illustrations/portal-sign-in.webp",
  /** "Nothing yet": a list or report with no rows. */
  empty: "/illustrations/empty.webp",
  /** A search or filter that matched nothing. */
  noResults: "/illustrations/no-results.webp",
  /** Nothing overdue or waiting. */
  allCaughtUp: "/illustrations/all-caught-up.webp",
  /** Something went wrong (DataState error, app error page). */
  error: "/illustrations/error.webp",
  /** A module whose backend isn't connected yet. */
  notConnected: "/illustrations/not-connected.webp",
  /** AccessDenied. */
  noAccess: "/illustrations/no-access.webp",
  /** The app-level not-found page. */
  notFound: "/illustrations/not-found.webp",
  /** The reports page before a report is picked. */
  pickReport: "/illustrations/pick-report.webp",
};

/**
 * The slots whose pictures are objects on a plain white background. They sit
 * on a rounded white tile in both modes: on a white card it's invisible, on
 * the grey page or a dark card it reads as a soft tile instead of a hard white
 * square. The sign-in scenes fill their own space and need no tile.
 */
export const ON_WHITE: ReadonlySet<IllustrationName> = new Set<IllustrationName>([
  "empty",
  "noResults",
  "allCaughtUp",
  "error",
  "notConnected",
  "noAccess",
  "notFound",
  "pickReport",
]);

/** The tile classes for a slot's picture: a rounded white tile for ON_WHITE slots, none otherwise. */
export function illustrationTileClass(name: IllustrationName): string {
  return ON_WHITE.has(name) ? "rounded-2xl bg-white p-1.5" : "";
}

/** The picture for a slot, or null when the slot is empty. */
export function illustrationSrc(name: IllustrationName): string | null {
  return ILLUSTRATIONS[name];
}
