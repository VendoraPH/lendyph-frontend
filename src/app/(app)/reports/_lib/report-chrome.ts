import { API_BASE_URL } from "@/lib/axios-client";
import type { ReportChrome, ReportDocument, ReportId, ReportSection } from "./types";

/**
 * Document identity, applied after a report is built.
 *
 * Kept out of `report-builders.ts` on purpose: the builders are pure
 * payload→document functions with no notion of a session, a logo, or who is
 * signed in. Chrome is the one part of a report that depends on all three, so
 * it is layered on at generate time and travels inside `meta` from there —
 * which means the preview, the PDF, the Word file and the Excel sheet all read
 * the same values instead of each re-deriving them.
 */

/** Short prefixes for the document reference, one per report. */
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
};

/** Sign-off roles. Cooperative reports are prepared, checked, then approved. */
const SIGNATORY_ROLES = ["Prepared by", "Checked by", "Approved by"];

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/**
 * `AGE-20260806-0915` — prefix, generation date, generation time.
 *
 * Built from local calendar parts rather than `toISOString()`, which would
 * stamp a Manila-evening report with the previous day's date.
 */
export function buildReference(reportId: ReportId, at = new Date()): string {
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `${REFERENCE_PREFIX[reportId]}-${stamp}`;
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
 * Merge chrome into a freshly built document.
 *
 * Only fills what the caller actually supplied — a report generated while the
 * branding request is still in flight keeps a null logo and renders the text
 * header, rather than blocking the preview on an image.
 */
export function applyChrome(
  doc: ReportDocument,
  chrome: ReportChrome
): ReportDocument {
  const withMeta: ReportDocument = {
    ...doc,
    meta: {
      ...doc.meta,
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
