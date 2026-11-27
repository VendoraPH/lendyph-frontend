import { VALID_ID_OPTIONS } from "@/constants";

/** An ID type in words: the picker's label, or the name typed for "Others". */
export function validIdTypeLabel(type: string, customName: string | null | undefined): string {
  const custom = customName?.trim();
  if (type === "others") return custom || "Others";
  return VALID_ID_OPTIONS.find((o) => o.value === type)?.label ?? custom ?? type;
}

/**
 * An ID row on a member form, for screen readers: its type when one is picked,
 * and always its place in the list, so two rows never read the same.
 */
export function validIdRowName(entry: { type: string; custom_type_name: string }, index: number): string {
  const place = `ID ${index + 1}`;
  return entry.type ? `${validIdTypeLabel(entry.type, entry.custom_type_name)} (${place})` : place;
}

/** The accessible name of the row's remove (X) button. */
export function removeValidIdRowLabel(entry: { type: string; custom_type_name: string }, index: number): string {
  return `Remove ${validIdRowName(entry, index)}`;
}
