/**
 * New Payment used to fold the cashier's method, reference and collector into a
 * payment's remarks as `[method=... | ref=... | collected_by=...]`, on its own
 * line after anything staff typed. Old rows keep that text, and their stored
 * method is not changed. It can be the only record of an old payment's reference
 * and collector, so the receipts read it as a sentence; History hides it.
 */
const LEGACY_PAYMENT_META = /^\[(method=[^\]\n]*)\][ \t]*\n?/gm;

/** A payment's remarks as staff typed them; empty when there is nothing else. */
export function withoutLegacyPaymentMeta(remarks: string | null | undefined): string {
  return (remarks ?? "").replace(LEGACY_PAYMENT_META, "").trim();
}

/** `method=GCash | ref=GC1` as "Recorded as GCash, reference GC1"; only what's there. */
function legacyMetaSentence(meta: string): string {
  const values = new Map(
    meta.split("|").map((part) => {
      const [key, ...value] = part.split("=");
      return [key.trim(), value.join("=").trim()] as const;
    }),
  );
  const parts = [
    values.get("method") && `recorded as ${values.get("method")}`,
    values.get("ref") && `reference ${values.get("ref")}`,
    values.get("collected_by") && `collected by ${values.get("collected_by")}`,
  ].filter(Boolean);
  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * A payment's remarks for a receipt: what staff typed, then the legacy line (if
 * the row has one) as a sentence. For display only; the stored row is untouched.
 */
export function readablePaymentRemarks(remarks: string | null | undefined): string {
  const typed = withoutLegacyPaymentMeta(remarks);
  const sentences = [...(remarks ?? "").matchAll(LEGACY_PAYMENT_META)]
    .map((match) => legacyMetaSentence(match[1]))
    .filter(Boolean);
  if (sentences.length === 0) return typed;
  const recorded = sentences.join(". ");
  if (!typed) return recorded;
  return `${typed}${/[.!?]$/.test(typed) ? "" : "."} ${recorded}`;
}
