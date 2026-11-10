import { RELATIONSHIP_OPTIONS } from "@/constants";

/**
 * A co-maker's relationship to the member in words: a stored value reads as its
 * label ("sibling" reads "Sibling"), one typed on the loan screen as itself,
 * and none as a dash.
 */
export function relationshipInWords(value: string | null | undefined): string {
  if (!value) return "—";
  return RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
