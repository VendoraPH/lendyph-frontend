// Where the loan page's release details card reads its deductions and net
// proceeds. Every figure is the server's; this only picks the endpoint and says
// whether to call the figures an estimate. Dependency-free, so it runs under
// `tsx --test`.

import type { LoanDeductionsPreview, LoanStatus } from "@/types/loan";

/**
 * - `deductions-preview`: `GET /loans/{id}/deductions-preview` (`loans:view`).
 * - `release-preview`: `GET /loans/{id}/release-preview` (`loans:release`).
 * - `recorded`: the deductions saved on the loan, once it is past release.
 */
export type CardDeductionsSource = "deductions-preview" | "release-preview" | "recorded";

/**
 * The card's source for a loan's status. What a loan records before release
 * leaves out the fees configured in Settings, so it is never shown until then.
 * At approved, whoever can release reads the answer the Release dialog stands on.
 */
export function cardDeductionsSource(status: LoanStatus, canRelease: boolean): CardDeductionsSource {
  if (status === "draft" || status === "for_review") return "deductions-preview";
  if (status === "approved") return canRelease ? "release-preview" : "deductions-preview";
  return "recorded";
}

/**
 * Whether the card labels its figures "Estimated until release": a loaded
 * deductions preview the server calls provisional. A preview with no flag counts
 * as provisional, since a label on a firm figure misleads nobody about the money.
 */
export function cardFiguresAreEstimated(
  source: CardDeductionsSource,
  figures: Pick<LoanDeductionsPreview, "provisional"> | null,
): boolean {
  return source === "deductions-preview" && figures !== null && figures.provisional !== false;
}
