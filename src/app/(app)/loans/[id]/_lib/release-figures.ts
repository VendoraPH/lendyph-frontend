// The Release dialog's insurance: what the cashier typed, as the release
// preview is asked about it and as the release sends it. Every peso figure the
// dialog shows for it — premium, amount collected, remaining balance, the
// deductions and net after insurance — is the server's
// (`GET /loans/{id}/release-preview` with these params); nothing here works
// one out. Dependency-free, so it runs under `tsx --test`.

import { getErrorMessage } from "@/lib/api-error";
import type { ReleaseLoanPayload, ReleasePreviewInsuranceQuery } from "@/services/loan.service";
import type { LoanReleasePreview } from "@/types/loan";
import type { InsurancePremiumValue } from "../_components/insurance-premium.types";

/** A typed amount as a number of pesos, or null when nothing usable is typed. */
function typedAmount(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n : null;
}

/** An input amount rounded to the centavo, the precision the server accepts. */
function toCentavo(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The insurance the cashier typed, as release-preview query params, or null
 * when there is none to ask about (no percentage, or 0%): the server then
 * charges no premium.
 *
 * The percentage goes as typed (the field allows two places); the server
 * refuses one above 100. A partial payment with nothing typed yet is 0
 * collected now, which the release has always accepted. The partial amount is
 * rounded to the centavo as an input; the server checks it against its own
 * premium.
 */
export function releaseInsuranceQuery(value: InsurancePremiumValue): ReleasePreviewInsuranceQuery | null {
  const percentage = typedAmount(value.percentage);
  if (percentage === null || percentage <= 0) return null;
  if (value.paymentType === "full") {
    return { insurance_premium_percentage: percentage, insurance_payment_type: "full" };
  }
  const partial = typedAmount(value.partialAmount);
  return {
    insurance_premium_percentage: percentage,
    insurance_payment_type: "partial",
    insurance_partial_amount: partial !== null && partial > 0 ? toCentavo(partial) : 0,
  };
}

/** The insurance fields of `PATCH /loans/{id}/release`. */
export type ReleaseInsurancePayload = Omit<ReleaseLoanPayload, "fee_fingerprint">;

/**
 * The insurance the release sends: the inputs that were previewed, plus the
 * server's own premium and remaining balance from that preview. The server
 * works the premium out again and refuses (422) one that differs by a
 * centavo, so the figure sent is always the one the cashier was shown. With
 * no insurance, nothing is sent.
 */
export function releaseInsurancePayload(
  query: ReleasePreviewInsuranceQuery | null,
  insurance: LoanReleasePreview["insurance"],
): ReleaseInsurancePayload {
  if (query === null || !insurance) return {};
  return {
    ...query,
    insurance_premium_amount: Number(insurance.premium_amount),
    insurance_remaining_balance: Number(insurance.remaining_balance),
  };
}

/**
 * The partial amount field after it loses focus: cleared when nothing usable
 * is typed, rounded to the centavo, and capped at the server's premium once
 * that is known. An input tidy, not a figure: what is collected and what is
 * left are still the server's.
 */
export function partialAmountOnBlur(raw: string, premiumAmount: string | null | undefined): string {
  const n = typedAmount(raw);
  if (n === null || n <= 0) return "";
  const premium = premiumAmount == null ? null : Number(premiumAmount);
  const capped = premium !== null && Number.isFinite(premium) ? Math.min(premium, n) : n;
  return String(toCentavo(capped));
}

/**
 * The partial amount typed is above the server's premium for this
 * percentage. A comparison only, to say so beside the field; the server
 * refuses such an amount (422) and the field caps it on blur.
 */
export function partialExceedsPremium(raw: string, premiumAmount: string | null | undefined): boolean {
  const n = typedAmount(raw);
  if (n === null || premiumAmount == null) return false;
  const premium = Number(premiumAmount);
  return Number.isFinite(premium) && n > premium;
}

/**
 * Where the insurance preview stands for what is typed now.
 * - `idle`: no insurance to ask about (`releaseInsuranceQuery` gave null).
 * - `loading`: waiting for the answer to exactly these inputs.
 * - `ready`: the server's release preview with this insurance applied.
 * - `error`: the server refused these inputs or could not be reached; no
 *   figures are shown and the release cannot be confirmed.
 */
export type ReleaseInsuranceView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: LoanReleasePreview }
  | { status: "error"; message: string };

/** How one insurance preview request ended, keyed by the query and attempt. */
export interface ReleaseInsuranceOutcome {
  key: string;
  attempt: number;
  view: Extract<ReleaseInsuranceView, { status: "ready" | "error" }>;
}

/** One loan's query as a comparable key: equal loan and query, equal keys. */
export function releaseInsuranceKey(
  loanId: number,
  query: ReleasePreviewInsuranceQuery | null,
): string | null {
  return query ? JSON.stringify([loanId, query]) : null;
}

/**
 * The view for what is typed now. An answer for any other query or attempt is
 * stale, so the dialog shows loading rather than figures for an insurance it
 * no longer has.
 */
export function releaseInsuranceView(
  key: string | null,
  attempt: number,
  outcome: ReleaseInsuranceOutcome | null,
): ReleaseInsuranceView {
  if (key === null) return { status: "idle" };
  if (!outcome || outcome.key !== key || outcome.attempt !== attempt) return { status: "loading" };
  return outcome.view;
}

/**
 * The server answer Confirm Release would stand on.
 * - `ready`: every figure on screen comes from `answer`, and its
 *   `fee_fingerprint` is the one the fee list above was read with.
 * - `waiting`: an answer for what is typed now is not in yet, or was refused.
 * - `stale`: the insurance answer was read against other fees than the fee
 *   list on screen (the fees changed between the two reads). Both are read
 *   again; until they agree nothing may be confirmed.
 * - `no_premium`: insurance is typed but the answer carries no premium, so
 *   there would be nothing to send for it.
 */
export type ReleaseConfirmView =
  | { status: "ready"; answer: LoanReleasePreview }
  | { status: "waiting" }
  | { status: "stale" }
  | { status: "no_premium" };

/**
 * Which server answer the release would be confirmed against. With no
 * insurance it is the release preview itself. With insurance it is the
 * preview asked about that insurance, and only while it was read against the
 * same fees (`fee_fingerprint`) as the release preview whose fee list is on
 * screen: confirming otherwise would send a fingerprint the server refuses
 * (409), or quote a net that disagrees with the fees listed above it.
 */
export function releaseConfirmView(
  base: LoanReleasePreview | null,
  query: ReleasePreviewInsuranceQuery | null,
  insurance: ReleaseInsuranceView,
): ReleaseConfirmView {
  if (base === null) return { status: "waiting" };
  if (query === null) return { status: "ready", answer: base };
  if (insurance.status !== "ready") return { status: "waiting" };
  const answer = insurance.preview;
  if (answer.fee_fingerprint !== base.fee_fingerprint) return { status: "stale" };
  if (!answer.insurance) return { status: "no_premium" };
  return { status: "ready", answer };
}

/**
 * What to do about a `stale` confirm view, given the mismatched pair of
 * fingerprints already re-read in this dialog (null for none).
 *
 * Which preview is out of date cannot be told, so both are read again — once
 * per pair. `pair` is the mismatch as a key (null unless the view is stale);
 * `reread` says to read both again now; `stuck` says the same pair survived a
 * re-read, so it is left to the cashier's Try again rather than asked about
 * forever.
 */
export function staleReread(
  view: ReleaseConfirmView,
  base: LoanReleasePreview | null,
  insurance: ReleaseInsuranceView,
  lastReread: string | null,
): { pair: string | null; reread: boolean; stuck: boolean } {
  const pair =
    view.status === "stale" && base !== null && insurance.status === "ready"
      ? `${base.fee_fingerprint}|${insurance.preview.fee_fingerprint}`
      : null;
  return {
    pair,
    reread: pair !== null && pair !== lastReread,
    stuck: pair !== null && pair === lastReread,
  };
}

/** Why an insurance preview failed, in the server's words where it gave any. */
export function releaseInsuranceFailureMessage(err: unknown): string {
  return getErrorMessage(err, "We couldn't work out the insurance. Please try again.");
}
