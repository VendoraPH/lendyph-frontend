/**
 * True when the server's money figure is nothing ("0.00", "0", empty), read
 * as text so no figure is parsed or compared. A ledger line shows only its
 * non-zero side.
 */
export function isNilAmount(value: string | null | undefined): boolean {
  return value === null || value === undefined || /^\s*0*(\.0*)?\s*$/.test(value);
}
