import { PAYMENT_FREQUENCY_OPTIONS } from "@/constants";
import { formatCurrency } from "@/lib/format";
import { inWords } from "@/lib/loan-origination";
import type { Consents, NoticeKey, PublicNotice, PublicPortal, PublicProduct } from "@/types/public-application";

/**
 * `PublicPortal::NOT_READY`: a link closed for a reason the public isn't told
 * (the server logs it) reads only "not ready".
 */
export const NOT_READY = "Online applications aren't ready yet. Please contact the office.";

type LinkState = Pick<PublicPortal, "accepting" | "closed_reason" | "otp_channels">;

/**
 * Why the link takes no new application, in the server's words, or null when
 * it does. With no code channel nobody gets past the code step, so an empty
 * `otp_channels` closes it too.
 */
export function linkClosure(portal: LinkState): string | null {
  if (portal.accepting && portal.otp_channels.length > 0) return null;
  return portal.closed_reason?.trim() || NOT_READY;
}

/** Why a submitted application can't be followed here: tracking needs a code, nothing else. */
export function trackingClosure(portal: LinkState): string | null {
  if (portal.otp_channels.length > 0) return null;
  return portal.closed_reason?.trim() || NOT_READY;
}

type Notices = Pick<PublicPortal, NoticeKey>;

/** True until every published notice is the owner's final wording. */
export function noticesAreDraft(portal: Notices): boolean {
  return [portal.privacy_notice, portal.terms, portal.declaration, portal.credit_authorization].some(
    (notice) => notice !== null && notice.final !== true,
  );
}

/** `OriginationNotice::TYPE_LABELS`, in the order the review lists them. */
const NOTICE_ORDER: readonly { key: NoticeKey; label: string }[] = [
  { key: "privacy_notice", label: "Privacy notice" },
  { key: "terms", label: "Terms and conditions" },
  { key: "credit_authorization", label: "Credit authorization" },
  { key: "declaration", label: "Declaration" },
];

/** Every published notice: the server refuses a submit that leaves out a current one. */
export function noticesToAccept(portal: Notices): { key: NoticeKey; label: string; notice: PublicNotice }[] {
  return NOTICE_ORDER.flatMap(({ key, label }) => {
    const notice = portal[key];
    return notice ? [{ key, label, notice }] : [];
  });
}

/** What submit sends: each current version, and the optional marketing choice. Null while a required notice is missing. */
export function consentsFor(portal: Notices, marketing: boolean): Consents | null {
  const { privacy_notice, terms, declaration, credit_authorization } = portal;
  if (!privacy_notice || !terms || !declaration) return null;
  return {
    privacy_notice_version: privacy_notice.version,
    terms_version: terms.version,
    declaration_version: declaration.version,
    credit_authorization_version: credit_authorization?.version ?? null,
    marketing_opt_in: marketing,
  };
}

/** The product's own amount limits in pesos, or null when it has none. */
export function amountRange(product: Pick<PublicProduct, "min_amount" | "max_amount">): string | null {
  const { min_amount: min, max_amount: max } = product;
  if (min !== null && max !== null) return `${formatCurrency(min)} to ${formatCurrency(max)}`;
  if (min !== null) return `From ${formatCurrency(min)}`;
  if (max !== null) return `Up to ${formatCurrency(max)}`;
  return null;
}

/** The product's term limits with their unit, or null when it has none. */
export function termRange(product: Pick<PublicProduct, "min_term" | "max_term" | "term_unit">): string | null {
  const { min_term: min, max_term: max, term_unit: unit } = product;
  if (min !== null && max !== null) return `${min} to ${max} ${unit}`;
  if (min !== null) return `From ${min} ${unit}`;
  if (max !== null) return `Up to ${max} ${unit}`;
  return null;
}

/** The most terms a list offers; a longer or open range is typed instead. */
const MAX_TERM_CHOICES = 60;

/** The terms to pick from (no minimum is 1, as the loan code reads it), or null to type one. */
export function termChoices(product: Pick<PublicProduct, "min_term" | "max_term">): number[] | null {
  const min = product.min_term ?? 1;
  const max = product.max_term;
  if (max === null || max < min || max - min + 1 > MAX_TERM_CHOICES) return null;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** A payment schedule in words ("Semi-Monthly"), never its key. */
export function scheduleWords(frequency: string): string {
  return inWords(frequency, PAYMENT_FREQUENCY_OPTIONS) ?? frequency;
}
