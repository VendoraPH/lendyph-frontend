import { siteConfig } from "@/config/site";
import { API_BASE_URL } from "@/lib/axios-client";
import { buildDocumentReference } from "@/lib/document-reference";
import { useBrandingStore } from "@/store/branding-store";
import type { ReportChrome, ReportDocument, ReportId, ReportSection } from "./types";

/**
 * Document identity, applied after a report is built.
 *
 * Kept out of `report-builders.ts` on purpose: the builders are pure
 * payload→document functions with no notion of a session, a logo, an
 * organization, or who is signed in. Chrome is the one part of a report that
 * depends on all four, so it is layered on at generate time and travels inside
 * `meta` from there — which means the preview, the PDF, the Word file and the
 * Excel sheet all read the same values instead of each re-deriving them.
 */

/**
 * Short prefixes for the document reference, one per report.
 *
 * Exhaustive over `ReportId` on purpose: adding a report without a prefix is a
 * compile error, not a document that quietly references `undefined-20260826`.
 */
const REFERENCE_PREFIX: Record<ReportId, string> = {
  daily_collection: "DCR",
  portfolio_summary: "PSR",
  income_report: "INC",
  aging_report: "AGE",
  borrower_report: "BRW",
  disbursement_report: "DSB",
  releases_list: "REL",
  repayments_list: "RPY",
  due_past_due_list: "DPD",
  statement_of_account: "SOA",
  subsidiary_ledger: "SLG",
  cash_flow: "CFL",
  collection_efficiency: "CEF",
  portfolio_by_product: "PBP",
  share_capital: "SCP",
  performance: "PRF",
  provisioning: "PRV",
};

/** Sign-off roles. Cooperative reports are prepared, checked, then approved. */
const SIGNATORY_ROLES = ["Prepared by", "Checked by", "Approved by"];

/**
 * `AGE-20260806-0915` — prefix, generation date, generation time.
 *
 * The stamp itself is `buildDocumentReference`, shared with the printables so
 * a report and a receipt are referenced the same way. It is built from local
 * calendar parts rather than `toISOString()`, which would stamp a
 * Manila-evening report with the previous day's date.
 */
export function buildReference(reportId: ReportId, at = new Date()): string {
  return buildDocumentReference(REFERENCE_PREFIX[reportId], at);
}

/**
 * Fetch the logo and encode it as a data URL for the binary exporters.
 *
 * The preview can point an `<img>` straight at the storage URL, but jsPDF and
 * docx need the bytes.
 *
 * Those bytes come from `/branding/logo` on the API, NOT from the storage URL
 * the preview uses. `/storage/**` is served by nginx off the public/storage
 * symlink and never reaches PHP, so it carries no CORS header and this read
 * always failed — every export quietly fell back to the text header. Going
 * through API_BASE_URL means the browser request is same-origin (Next rewrites
 * it server-side), so no CORS is involved at all.
 *
 * `url` is still the gate: it is null when no logo is configured, and this
 * fails soft either way — a null result means the exports lead with the
 * organization name, as they did before the logo existed.
 */
export async function loadLogoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/branding/logo`, { credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Whose name goes on the letterhead, read from whatever the store holds *now*.
 *
 * Lendyph is single-tenant-per-deployment, so this must never be a constant in
 * shared code — a hardcoded name meant every deployment printed the same
 * cooperative's letterhead. It resolves the same way the logo does: from the
 * branding settings the deployment configured, read here rather than in the
 * builders so those stay pure.
 *
 * `getState()` rather than the hook: chrome is applied from an event handler
 * and from non-React callers, and neither may subscribe.
 *
 * Falls back to `siteConfig.name` when nothing is configured, so a fresh
 * deployment still produces a headed document instead of a blank line.
 *
 * This is the synchronous last step only. It cannot tell "this deployment
 * configured no name" apart from "the branding request has not come back yet",
 * and both read as the fallback — so nothing that stamps a document may call
 * it directly. Go through `loadOrgName()` (or `applyChrome()`, which does).
 */
export function resolveOrgName(...candidates: (string | null | undefined)[]): string {
  const configured = [...candidates, useBrandingStore.getState().organizationName];
  for (const candidate of configured) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return siteConfig.name;
}

/**
 * The same resolution, but waits for branding to actually be there first.
 *
 * The fallback is a trap on a cold page load. `meta.org` is written once, at
 * generate time, and every later read — the preview, the PDF, the Word file,
 * the Excel sheet, the CSV — quotes that stored string rather than re-reading
 * the store. So a Generate that lands before the branding fetch resolves does
 * not merely render `Lendy.PH` for a moment; it freezes the product's name
 * into a cooperative's letterhead for the life of that document and every
 * export of it. That is the exact failure that removing the hardcoded `ORG`
 * was meant to end, arriving through a different door.
 *
 * `load()` is the store's own shared-inFlight fetch, so this joins the request
 * the page already kicked off on mount instead of issuing a second one, and
 * costs nothing at all once branding has loaded. The same thing
 * `resolvePrintableOrg()` does on the printables side.
 *
 * Never rejects: `load()` swallows its own failure, and the catch here covers
 * a future one. A failed read leaves the store empty and the document is still
 * headed — by `siteConfig.name`, which at that point is a genuine answer
 * rather than a race.
 */
export async function loadOrgName(
  ...candidates: (string | null | undefined)[]
): Promise<string> {
  try {
    await useBrandingStore.getState().load();
  } catch {
    // Fall through to whatever the store already holds.
  }
  return resolveOrgName(...candidates);
}

/**
 * Merge chrome into a freshly built document.
 *
 * Only fills what the caller actually supplied — a report generated while the
 * logo is still being fetched and encoded keeps a null logo and renders the
 * text header, rather than blocking the preview on an image. The organization
 * name is the one exception, twice over: it always resolves to something,
 * because a document with no letterhead at all is not a document — and it is
 * the one field worth waiting for, which is why this is async. See
 * `loadOrgName()` for what the wait prevents.
 */
export async function applyChrome(
  doc: ReportDocument,
  chrome: ReportChrome
): Promise<ReportDocument> {
  const withMeta: ReportDocument = {
    ...doc,
    meta: {
      ...doc.meta,
      org: await loadOrgName(chrome.org, doc.meta.org),
      logoUrl: chrome.logoUrl ?? null,
      logoData: chrome.logoData ?? null,
      preparedBy: chrome.preparedBy ?? null,
      branchLabel: chrome.branchLabel ?? null,
      reference: chrome.reference ?? buildReference(doc.reportId),
    },
  };

  // The sign-off block closes the document, so it is appended rather than
  // built into each report. Appending twice would stack two blocks on a
  // regenerate, so an existing one wins.
  const hasSignatures = withMeta.sections.some((s) => s.kind === "signatures");
  if (hasSignatures) return withMeta;

  const signatures: ReportSection = { kind: "signatures", roles: SIGNATORY_ROLES };
  return { ...withMeta, sections: [...withMeta.sections, signatures] };
}
