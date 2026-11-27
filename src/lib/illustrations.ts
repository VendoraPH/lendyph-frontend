/**
 * Pictures for the empty, error and no-access screens, the module lists, the
 * catalog headings and the member portal's greeting, by slot.
 *
 * Each value is a path the app serves from `public/illustrations/`, or null.
 * A null slot renders the screen exactly as it was before pictures existed,
 * so a deployment never shows a broken image while a picture is missing.
 * Fill a slot by dropping the file into `public/illustrations/` and setting
 * its path here; the screens pick it up with no other change.
 */
export const ILLUSTRATION_NAMES = [
  "empty",
  "noResults",
  "allCaughtUp",
  "error",
  "notConnected",
  "noAccess",
  "notFound",
  "pickReport",
  "emptyLoans",
  "emptyMembers",
  "emptyPayments",
  "emptySavings",
  "emptyShareCapital",
  "emptyCollaterals",
  "emptyWallet",
  "emptyLedger",
  "emptyCompliance",
  "emptyReminders",
  "emptyDocuments",
  "portalWelcome",
] as const;

export type IllustrationName = (typeof ILLUSTRATION_NAMES)[number];

/**
 * One picture per module, for a list that has nothing in it yet. A search or
 * filter that matched nothing keeps `noResults`, and "nothing overdue or
 * waiting" keeps `allCaughtUp`.
 */
export const MODULE_ILLUSTRATION_NAMES = [
  "emptyLoans",
  "emptyMembers",
  "emptyPayments",
  "emptySavings",
  "emptyShareCapital",
  "emptyCollaterals",
  "emptyWallet",
  "emptyLedger",
  "emptyCompliance",
  "emptyReminders",
  "emptyDocuments",
] as const satisfies readonly IllustrationName[];

export type ModuleIllustrationName = (typeof MODULE_ILLUSTRATION_NAMES)[number];

/** The pictures an empty list or panel can show. */
export type EmptyIllustrationName = "empty" | "noResults" | "allCaughtUp" | ModuleIllustrationName;

/**
 * The picture for an empty list: its module's picture while nothing is
 * searched or filtered, otherwise `noResults`.
 */
export function emptyArt(module: ModuleIllustrationName, filtered: boolean): EmptyIllustrationName {
  return filtered ? "noResults" : module;
}

export const ILLUSTRATIONS: Readonly<Record<IllustrationName, string | null>> = {
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
  /** Module pictures: a list in that module with nothing in it yet. */
  emptyLoans: "/illustrations/empty-loans.webp",
  emptyMembers: "/illustrations/empty-members.webp",
  emptyPayments: "/illustrations/empty-payments.webp",
  emptySavings: "/illustrations/empty-savings.webp",
  emptyShareCapital: "/illustrations/empty-share-capital.webp",
  emptyCollaterals: "/illustrations/empty-collaterals.webp",
  /** GCash. */
  emptyWallet: "/illustrations/empty-wallet.webp",
  /** Accounting: journals, expenses, chart of accounts, books. */
  emptyLedger: "/illustrations/empty-ledger.webp",
  /** CDA lists: calendar, submissions. */
  emptyCompliance: "/illustrations/empty-compliance.webp",
  emptyReminders: "/illustrations/empty-reminders.webp",
  /** CDA documents, printables, and the member portal's documents and requests. */
  emptyDocuments: "/illustrations/empty-documents.webp",
  /** The member portal home's greeting row (960x540, wide). */
  portalWelcome: "/illustrations/portal-welcome.webp",
};

/**
 * Whether a list's filter object narrows the list: any key other than paging
 * (`page`, `per_page`) that holds a value. Unset, null and empty values don't
 * count.
 */
export function filtersActive(filters: object): boolean {
  return Object.entries(filters).some(
    ([key, value]) => key !== "page" && key !== "per_page" && value !== undefined && value !== null && value !== "",
  );
}

/**
 * The tile every picture sits on. The pictures are objects on a plain white
 * background, so in both modes they sit on a rounded white tile: on a white
 * card it's invisible, on the grey page or a dark card it reads as a soft tile
 * instead of a hard white square.
 */
export function illustrationTileClass(): string {
  return "rounded-2xl bg-white p-1.5";
}

/** The picture for a slot, or null when the slot is empty. */
export function illustrationSrc(name: IllustrationName): string | null {
  return ILLUSTRATIONS[name];
}
