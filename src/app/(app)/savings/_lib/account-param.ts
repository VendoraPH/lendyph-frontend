/** `?account=12` → 12; anything that isn't a positive whole number → null. */
export function parseAccountParam(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
