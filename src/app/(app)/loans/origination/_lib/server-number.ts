/**
 * A number the server already rounded, written with the decimals it rounded
 * to: padded with zeros, never rounded again (40.1 reads "40.10" at two
 * places, 2 reads "2.0" at one). A value with more decimals than asked keeps
 * them all, since cutting them would round it.
 */
export function padDecimals(value: number, places: number): string {
  const text = String(value);
  if (/e/i.test(text)) return text;
  const [whole, decimals = ""] = text.split(".");
  return decimals.length >= places ? text : `${whole}.${decimals.padEnd(places, "0")}`;
}
