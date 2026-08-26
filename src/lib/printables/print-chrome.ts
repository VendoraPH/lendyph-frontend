import { siteConfig } from "@/config/site";
import { fileUrl, withVersion } from "@/lib/file-url";
import { formatGeneratedAt } from "@/lib/report-format";
import { useBrandingStore } from "@/store/branding-store";
import type { PrintableDocument, PrintableId, PrintableOrg } from "./types";

/**
 * Document identity, applied after a template builds.
 *
 * The same split `report-chrome.ts` already makes, and for the same reason:
 * templates are pure `payload -> document` functions with no notion of a
 * session, a logo, or which cooperative this deployment belongs to. Chrome is
 * the one layer that depends on all of it, so it is added at open time and
 * travels inside the document from there — which means the print window, and
 * anything that later re-renders the same document, read one reference instead
 * of each minting their own.
 */

/**
 * Short prefixes for the document reference, one per printable.
 *
 * Exhaustive over `PrintableId` on purpose: adding a document without giving it
 * a prefix fails the typecheck rather than shipping a reference that reads
 * `undefined-20260826-0142`.
 */
const REFERENCE_PREFIX: Record<PrintableId, string> = {
  disclosure_statement: "DIS",
  promissory_note: "PN",
  official_receipt: "OR",
  release_voucher: "RV",
  demand_letter: "DL",
  amortization_schedule: "AMS",
  share_capital_certificate: "SCC",
  member_ledger_card: "MLC",
};

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/**
 * `OR-20260826-0142` — prefix, issue date, issue time.
 *
 * Built from local calendar parts rather than `toISOString()`, which would
 * stamp a document printed on a Manila evening with the previous day's date.
 * On a receipt handed to a member that is not cosmetic: the reference is what
 * the branch quotes back when the payment is queried.
 */
export function buildPrintableReference(id: PrintableId, at = new Date()): string {
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `${REFERENCE_PREFIX[id]}-${stamp}`;
}

/**
 * Stamp a freshly built document with its reference and generation time.
 *
 * Idempotent, and an existing value always wins. A reprint of an official
 * receipt must carry the reference it was first issued under — re-minting it
 * would hand the member a second, differently-numbered copy of the same
 * payment. Templates that already know their reference (a receipt number from
 * the API is the obvious one) simply set it and this leaves it alone.
 *
 * Returns a new document; the built one is never mutated.
 */
export function applyPrintChrome(
  doc: PrintableDocument,
  at = new Date()
): PrintableDocument {
  return {
    ...doc,
    reference: doc.reference || buildPrintableReference(doc.id, at),
    generatedAt: doc.generatedAt || formatGeneratedAt(at),
  };
}

function trimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

/**
 * The branding fields a letterhead needs, all optional.
 *
 * Typed loosely against the store rather than importing its state interface so
 * this module compiles both before and after the organization fields land in
 * `branding-store.ts` — the two are being built in parallel, and a hard
 * dependency would mean neither could be typechecked on its own.
 */
interface BrandingLetterheadState {
  logoUrl?: string | null;
  organizationName?: string | null;
  address?: string | null;
  contact?: string | null;
  version?: number;
}

/**
 * Absolute URL for the letterhead logo, or null.
 *
 * A printable is rendered into a `blob:` document, and a blob URL has an opaque
 * path — a relative `src` inside it has nothing to resolve against and the logo
 * silently fails to load. So the URL is made absolute here, in the one function
 * that is allowed to know about the browser, rather than in the renderer.
 *
 * There is deliberately no fallback to the bundled `Lendy.PH` asset that
 * `<BrandLogo>` uses. This is single-tenant-per-deployment: printing the
 * product's own logo on another cooperative's promissory note is worse than
 * printing no logo at all, and the letterhead degrades to the organization name
 * perfectly well.
 */
function absoluteLogoUrl(raw: string | null | undefined, version = 0): string | null {
  const resolved = fileUrl(raw);
  if (!resolved) return null;

  const versioned = withVersion(resolved, version);
  if (/^https?:\/\//i.test(versioned)) return versioned;
  if (typeof window === "undefined") return null;

  try {
    return new URL(versioned, window.location.origin).href;
  } catch {
    return null;
  }
}

/**
 * Letterhead identity for the deployment, resolved from branding settings.
 *
 * `load()` is the store's own shared-inFlight fetch, so calling this from a
 * print button costs one request no matter how many printables are opened, and
 * nothing if the sidebar logo has already loaded it. It never rejects; a failed
 * read leaves every field null and the document still prints, headed by
 * `siteConfig.name`.
 *
 * @param branchLabel Branch the document is issued by, when the subject has one.
 */
export async function resolvePrintableOrg(
  branchLabel?: string | null
): Promise<PrintableOrg> {
  try {
    await useBrandingStore.getState().load();
  } catch {
    // Fall through to whatever the store already holds.
  }

  // Re-read: `load()` is what populated it.
  const state = useBrandingStore.getState() as BrandingLetterheadState;

  return {
    name: trimmed(state.organizationName) ?? siteConfig.name,
    logoUrl: absoluteLogoUrl(state.logoUrl, state.version ?? 0),
    address: trimmed(state.address),
    contact: trimmed(state.contact),
    branchLabel: trimmed(branchLabel),
  };
}
