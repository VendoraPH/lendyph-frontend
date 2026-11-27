import type { PaymentBadgeType, RepaymentPreview } from "@/services/repayment.service";
import { getErrorMessage } from "@/lib/api-error";
import { previewInsuranceApplied } from "@/lib/insurance-premium";
import { currencyOrDash, toNumber } from "@/lib/report-format";

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
    nextInterestApplied: preview.allocated_to_next_interest ?? 0,
    nextPrincipalApplied: preview.allocated_to_next_principal ?? 0,
    // Insurance premium owed on the loan, collected before everything else.
    insuranceApplied: previewInsuranceApplied(preview) ?? 0,
  };
}

export interface PreviewExcessTile {
  key: "build_up" | "overpayment" | "excess";
  label: string;
  amount: number;
  note: string | null;
}

const BUILD_UP_TILE = { key: "build_up", label: "Excess → Share Capital", note: "will credit the member's share capital build-up" } as const;
const OVERPAYMENT_TILE = { key: "overpayment", label: "Advance / Overpayment", note: "kept on the loan as an advance" } as const;

/** A figure above ₱0.00, to the centavo, or null. */
function aboveZero(raw: unknown): number | null {
  const n = sentFigure(raw);
  return n !== null && Math.round(n * 100) > 0 ? n : null;
}

/**
 * Where the preview's excess (the server's `excess`, what the periods didn't
 * take) goes. When the preview sends its own split (`build_up_credited`,
 * `overpayment_kept`) each part is its own tile. Otherwise the server credits
 * the excess to share capital only on a loan with a build-up (`scb_amount`
 * above zero) and keeps it as an overpayment on any other, so the loan
 * decides the words; while that isn't known, the tile names neither. The
 * amounts are the server's, as sent.
 */
export function previewExcessTiles(preview: RepaymentPreview, loanHasBuildUp: boolean | null): PreviewExcessTile[] {
  const sent = preview as RepaymentPreview & Record<string, unknown>;
  if ("build_up_credited" in sent || "overpayment_kept" in sent) {
    const tiles: PreviewExcessTile[] = [];
    const buildUp = aboveZero(sent.build_up_credited);
    const kept = aboveZero(sent.overpayment_kept);
    if (buildUp !== null) tiles.push({ ...BUILD_UP_TILE, amount: buildUp });
    if (kept !== null) tiles.push({ ...OVERPAYMENT_TILE, amount: kept });
    return tiles;
  }
  const excess = aboveZero(preview.excess);
  if (excess === null) return [];
  if (loanHasBuildUp === null) return [{ key: "excess", label: "Excess", amount: excess, note: null }];
  return [{ ...(loanHasBuildUp ? BUILD_UP_TILE : OVERPAYMENT_TILE), amount: excess }];
}

const CELL_LABELS: Record<PreviewExcessTile["key"], string> = {
  build_up: "Share Capital",
  overpayment: "Overpayment",
  excess: "Excess",
};

/**
 * The allocation grid's excess cell, beside Penalty, Interest and Principal:
 * one per part the preview's excess goes to (previewExcessTiles()). With
 * nothing over, one cell named by the loan shows the server's `excess` as
 * sent (₱0.00), or a dash when it sent none.
 */
export function previewExcessCells(
  preview: RepaymentPreview,
  loanHasBuildUp: boolean | null,
): { key: PreviewExcessTile["key"]; label: string; amount: string }[] {
  const tiles = previewExcessTiles(preview, loanHasBuildUp);
  if (tiles.length > 0) {
    return tiles.map((tile) => ({ key: tile.key, label: CELL_LABELS[tile.key], amount: currencyOrDash(tile.amount) }));
  }
  const key = loanHasBuildUp === null ? "excess" : loanHasBuildUp ? "build_up" : "overpayment";
  return [{ key, label: CELL_LABELS[key], amount: currencyOrDash(sentFigure(preview.excess)) }];
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
