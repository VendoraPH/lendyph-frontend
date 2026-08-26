function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/**
 * `AGE-20260806-0915`, `OR-20260826-0142` — prefix, date, time.
 *
 * The one stamp behind both `buildReference` (reports) and
 * `buildPrintableReference` (printables); each keeps its own exhaustive prefix
 * map, which is what makes "a document without a prefix" a compile error
 * rather than a reference reading `undefined-20260826`.
 *
 * Built from local calendar parts rather than `toISOString()`, which would
 * stamp a Manila-evening document with the previous day's date. On a receipt
 * handed to a member that is not cosmetic: the reference is what the branch
 * quotes back when the payment is queried.
 */
export function buildDocumentReference(prefix: string, at = new Date()): string {
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `${prefix}-${stamp}`;
}
