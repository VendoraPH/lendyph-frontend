import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashChargePreview } from "@/types";

/**
 * Where a dialog's charge preview stands for the amount in the box. The
 * charge and total are only ever the server's (`GET /gcash/transactions/preview`);
 * nothing here works one out.
 * - `idle`: no positive amount to preview yet.
 * - `loading`: waiting for the preview of this exact amount.
 * - `no_tier`: no fee tier covers the amount (the server's 422).
 * - `invalid`: the server refused the amount for another reason.
 * - `error`: the preview failed; retrying may fix it.
 */
export type ChargePreviewView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: GCashChargePreview }
  | { status: "no_tier" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

type SettledView = Exclude<ChargePreviewView, { status: "idle" | "loading" }>;

/** How one preview request ended, keyed by the amount and attempt it was for. */
export interface ChargePreviewOutcome {
  amount: number;
  attempt: number;
  view: SettledView;
}

export function isPreviewableAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

/**
 * The view for the amount now in the box. An outcome for any other amount or
 * attempt is stale, so the dialog shows loading rather than a figure that
 * belongs to something else.
 */
export function chargePreviewView(
  amount: number,
  attempt: number,
  outcome: ChargePreviewOutcome | null,
): ChargePreviewView {
  if (!isPreviewableAmount(amount)) return { status: "idle" };
  if (!outcome || outcome.amount !== amount || outcome.attempt !== attempt) {
    return { status: "loading" };
  }
  return outcome.view;
}

interface ErrorResponse {
  status?: number;
  data?: { message?: string; errors?: { amount?: string[] } };
}

/**
 * A failed preview as the dialog shows it. A 422 whose amount error names the
 * fee tiers is the no-tier case; any other 422 is the server's reason the
 * amount can't be used (e.g. more than two decimals).
 */
export function previewFailureView(err: unknown): SettledView {
  const response = (err as { response?: ErrorResponse } | null)?.response;
  if (response?.status === 422) {
    const message = response.data?.errors?.amount?.[0] ?? response.data?.message ?? "";
    if (/tier/i.test(message)) return { status: "no_tier" };
    return { status: "invalid", message: message || "This amount can't be used." };
  }
  return { status: "error", message: extractGCashErrorMessage(err) };
}
