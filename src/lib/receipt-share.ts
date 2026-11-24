/**
 * Receipt share links (finish run round 2, decision 6): the words and lines
 * both screens show, as pure functions. Every figure is the server's, shown as
 * sent; nothing here adds anything up.
 */
import { httpStatusOf } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
import { INSURANCE_PREMIUM_LABEL, repaymentInsuranceApplied } from "@/lib/insurance-premium";
import { receiptExtraLines } from "@/lib/receipt-extras";
import type { PublicReceipt, ReceiptShareLink } from "@/types/receipt-share";

/** 32 random bytes, base64url without padding. */
const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** One answer for every link that doesn't open: it never says why. */
export const PUBLIC_RECEIPT_UNAVAILABLE =
  "This receipt link isn't available. Ask the cooperative for a new link.";

export const PUBLIC_RECEIPT_TOO_MANY = "Too many tries. Please wait a minute and try again.";

const PUBLIC_RECEIPT_UNREACHABLE = "We couldn't open this receipt. Check your connection and try again.";

export function isShareToken(token: string): boolean {
  return SHARE_TOKEN.test(token);
}

/** The address a member opens: this app's own origin, then /r/ and the token. */
export function shareLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/r/${encodeURIComponent(token)}`;
}

/** A link's status in words, with Manila dates. */
export function shareLinkStatusText(link: ReceiptShareLink): string {
  switch (link.status) {
    case "active": {
      const made = link.created_by && link.created_at ? ` Made by ${link.created_by} on ${formatDate(link.created_at)}.` : "";
      return `Working until ${formatDate(link.expires_at)}.${made}`;
    }
    case "expired":
      return `The last link expired on ${formatDate(link.expires_at)}.`;
    case "revoked": {
      const when = link.revoked_at ? ` on ${formatDate(link.revoked_at)}` : "";
      const by = link.revoked_by ? ` by ${link.revoked_by}` : "";
      return `The last link was revoked${when}${by}.`;
    }
  }
}

/** "Ending in 7890": the only part of a reference a shared receipt shows. */
export function referenceEnding(last4: string | null): string | null {
  return last4 ? `Ending in ${last4}` : null;
}

export interface PublicReceiptLine {
  label: string;
  amount: string;
}

/**
 * The amount paid's split, in the staff receipt's order and words: the
 * insurance premium collected (only when there was one), penalty, interest,
 * principal, then the build-up and overpayment lines by the staff receipt's
 * own rule (`receiptExtraLines`).
 */
export function publicReceiptLines(receipt: PublicReceipt): PublicReceiptLine[] {
  const premium = repaymentInsuranceApplied(receipt);
  return [
    ...(premium === null ? [] : [{ label: INSURANCE_PREMIUM_LABEL, amount: formatCurrency(receipt.insurance_applied) }]),
    { label: "Penalty", amount: formatCurrency(receipt.penalty_applied) },
    { label: "Interest", amount: formatCurrency(receipt.interest_applied) },
    { label: "Principal", amount: formatCurrency(receipt.principal_applied) },
    ...receiptExtraLines({ ...receipt }),
  ];
}

/** What the public page says when the receipt doesn't come back. */
export function publicReceiptErrorMessage(err: unknown): string {
  const status = httpStatusOf(err);
  if (status === 429) return PUBLIC_RECEIPT_TOO_MANY;
  if (status !== null && status >= 400 && status < 500) return PUBLIC_RECEIPT_UNAVAILABLE;
  return PUBLIC_RECEIPT_UNREACHABLE;
}
