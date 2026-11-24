/** A stored key ("additional_info_required") as a sentence-case phrase, for a key the screen has no words for. */
export function words(key: string): string {
  const text = key.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
