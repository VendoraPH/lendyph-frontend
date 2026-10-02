import type { PaymentBadgeType, RepaymentPreview } from "@/services/repayment.service";

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
  };
}
