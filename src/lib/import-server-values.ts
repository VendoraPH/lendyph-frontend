/**
 * How the server reads a cell's value (`ValueNormalizer`, lendyph-backend
 * app/Services/CsvImport), mirrored for the pre-check's rules: the members
 * file's amounts (`./import-member-fields`) and the loans file's amounts, rate
 * and term (`./import-loan-fields`). Each refusal is the server's condition,
 * in the server's words. A prediction only: the server decides.
 *
 * Pure, so it runs under `tsx --test`.
 */

export type Reading<T> = { ok: true; value: T } | { ok: false; message: string };

/** `ValueNormalizer::MAX_CENTAVOS`: ₱9,999,999,999.99. Whole centavos are BigInt, exact at any length. */
const MAX_CENTAVOS = BigInt("999999999999");
const CENTAVOS_PER_PESO = BigInt(100);

/** `decimal(8,4)`, as `ValueNormalizer::rate()` caps it. */
const MAX_RATE = 9999.9999;

/**
 * A cell as `ValueNormalizer::text()` leaves it: byte-order marks dropped, a
 * non-breaking space a space, trimmed.
 */
export function serverText(raw: string): string {
  return raw.replace(/\uFEFF/g, "").replace(/\u00A0/g, " ").trim();
}

/** Characters as the server counts them (`mb_strlen`), not UTF-16 units. */
export function serverLength(value: string): number {
  return [...value].length;
}

/** `ValueNormalizer::centavos()`: an amount in whole centavos, or its refusal. */
export function readCentavos(original: string): Reading<bigint> {
  if (original.startsWith("(") || original.endsWith(")")) {
    return { ok: false, message: `"${original}" is written in accounting notation for a negative amount. Negative amounts cannot be imported.` };
  }
  const value = original.replace(/[₱, \u00A0]/g, "").replace(/php/gi, "").replace(/^\++/, "");
  if (value.startsWith("-") || value.endsWith("-")) {
    return { ok: false, message: `"${original}" is a negative amount, which cannot be imported.` };
  }
  if (/^\d*\.\d{3,}$/.test(value)) {
    return {
      ok: false,
      message: `"${original}" has more than 2 decimal places. Round it to centavos in the source file — this importer will not round it for you.`,
    };
  }
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(value)) {
    return { ok: false, message: `"${original}" is not a valid amount.` };
  }
  const [whole, fraction = ""] = value.split(".");
  const centavos = BigInt(whole === "" ? "0" : whole) * CENTAVOS_PER_PESO + BigInt(fraction.padEnd(2, "0"));
  if (centavos > MAX_CENTAVOS) {
    return { ok: false, message: `"${original}" is larger than the maximum this system stores (9,999,999,999.99).` };
  }
  return { ok: true, value: centavos };
}

/** `ValueNormalizer::rate()`: percent signs, spaces and commas dropped. */
export function readRate(original: string): Reading<string> {
  const value = original.replace(/[% ,]/g, "").trimEnd();
  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    return { ok: false, message: `"${original}" is not a valid interest rate.` };
  }
  if (Number(value) > MAX_RATE) {
    return { ok: false, message: `"${original}" is larger than the maximum interest rate this system stores.` };
  }
  return { ok: true, value };
}

/** `ValueNormalizer::integer()`: commas and spaces dropped, digits only, within the range. */
export function readInteger(original: string, min: number, max: number): Reading<number> {
  const value = original.replace(/[, ]/g, "");
  if (!/^\d+$/.test(value)) {
    return { ok: false, message: `"${original}" is not a whole number.` };
  }
  const number = Number(value);
  if (number < min || number > max) {
    return { ok: false, message: `"${original}" is outside the accepted range ${min}–${max}.` };
  }
  return { ok: true, value: number };
}
