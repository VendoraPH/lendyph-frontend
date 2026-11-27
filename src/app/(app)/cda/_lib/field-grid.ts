/**
 * A report section's field rows from 2xl, where they run in two columns in the
 * template's order (left to right): a text area takes both columns, and every
 * row but the first gets the divider the single column draws with `divide-y`
 * (the card's header already sits above the first row). Below 2xl these
 * classes do nothing. One class list per field, in the fields' order.
 */
export function fieldGridCells(types: readonly string[]): string[] {
  const wide = (type: string | undefined) => type === "textarea";
  // The first row is the first field alone when it, or the field after it, is a text area.
  const firstRow = types.length < 2 || wide(types[0]) || wide(types[1]) ? 1 : 2;
  return types.map((type, i) => [wide(type) && "2xl:col-span-2", i >= firstRow && "2xl:border-t"].filter(Boolean).join(" "));
}
