// The accounting screens' stored keys in words. Dependency-free so it runs under
// `tsx --test`.

const WORDS_THAT_KEEP_THEIR_CASE: Record<string, string> = { gcash: "GCash" };

/** "loan_release" → "Loan Release", "gcash" → "GCash". Any new key reads the same way. */
function inWords(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => WORDS_THAT_KEEP_THEIR_CASE[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The source is a string, not `JournalSource`: the server has values the union doesn't. */
export const journalSourceLabel = (source: string): string => inWords(source);
export const journalStatusLabel = (status: string): string => inWords(status);
export const accountTypeLabel = (type: string): string => inWords(type);
export const cashKindLabel = (kind: string): string => inWords(kind);
export const periodStatusLabel = (status: string): string => inWords(status);
