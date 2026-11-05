/**
 * New Payment used to fold the cashier's method, reference and collector into a
 * payment's remarks as `[method=... | ref=... | collected_by=...]`, on its own
 * line after anything staff typed. Old rows keep that text, and their stored
 * method is not changed; screens and documents just don't show it.
 */
const LEGACY_PAYMENT_META = /^\[method=[^\]\n]*\][ \t]*\n?/gm;

/** A payment's remarks as staff typed them; empty when there is nothing else. */
export function withoutLegacyPaymentMeta(remarks: string | null | undefined): string {
  return (remarks ?? "").replace(LEGACY_PAYMENT_META, "").trim();
}
