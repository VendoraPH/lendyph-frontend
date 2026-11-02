import type { PaymentBadgeType, RepaymentPreview } from "@/services/repayment.service";
import { getErrorMessage } from "@/lib/api-error";
import { previewInsuranceApplied } from "@/lib/insurance-premium";
import { toNumber } from "@/lib/report-format";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const BADGE_VARIANTS: Record<PaymentBadgeType, BadgeVariant> = {
  partial: "destructive",
  exact: "default",
  advance: "secondary",
};

/**
 * The badge the server gave this preview: partial, exact or advance against
 * what is due on or before the payment date (or the next instalment when
 * nothing is due yet). The page used to guess it from the loan's summary
 * figures, and badged a ₱10,000 partial payment "Full Payment (with arrears)".
 */
export function previewBadge(preview: RepaymentPreview): { label: string; variant: BadgeVariant } | null {
  const badge = preview.payment_badge;
  if (!badge) return null;
  return { label: badge.label, variant: BADGE_VARIANTS[badge.type] ?? "outline" };
}

/**
 * Where the payment goes, as the server's preview allocated it. That preview
 * runs the real repayment code and rolls it back, so it is what posting this
 * amount on this date will record; nothing here is estimated in the browser.
 */
export function previewAllocation(preview: RepaymentPreview) {
  return {
    penaltyApplied: preview.total_penalty ?? 0,
    interestApplied: preview.total_interest ?? 0,
    principalApplied: preview.total_principal ?? 0,
    scbApplied: preview.excess ?? 0,
    nextInterestApplied: preview.allocated_to_next_interest ?? 0,
    nextPrincipalApplied: preview.allocated_to_next_principal ?? 0,
    // Insurance premium owed on the loan, collected before everything else.
    insuranceApplied: previewInsuranceApplied(preview) ?? 0,
  };
}

/** One field of a preview read off the wire; undefined when it isn't an object. */
function field(preview: unknown, key: string): unknown {
  return preview && typeof preview === "object" ? (preview as Record<string, unknown>)[key] : undefined;
}

/** A figure as the server sent it; null when missing or unreadable (a dash), 0 kept. */
function sentFigure(raw: unknown): number | null {
  return typeof raw === "number" || typeof raw === "string" ? toNumber(raw) : null;
}

/**
 * The preview's outstanding balance before the payment: everything owed
 * (principal, interest, penalty and premium owed), the loan page's figure.
 * Never the principal-only `balance_before`. Null when not sent.
 */
export function previewTotalOutstandingBefore(preview: unknown): number | null {
  return sentFigure(field(preview, "total_outstanding_before"));
}

/** The preview's outstanding balance after the payment, as above. Null when not sent. */
export function previewTotalOutstandingAfter(preview: unknown): number | null {
  return sentFigure(field(preview, "total_outstanding_after"));
}

/** What a failed Post Payment says: the server's reason when it gave one. */
export function postPaymentErrorMessage(err: unknown): string {
  return getErrorMessage(err, "We couldn't post the payment. Please try again.");
}
