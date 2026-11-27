import { normaliseSearchQuery } from "@/hooks/use-search-page";

/** The longest `search` the member scores list accepts. */
export const MEMBER_SEARCH_MAX = 100;

/**
 * The member scores list's `search` (a name or member code, matched on the
 * server): trimmed with single spaces, at most 100 characters, and left out
 * when empty.
 */
export function memberSearchParam(raw: string): string | undefined {
  const query = normaliseSearchQuery(raw).slice(0, MEMBER_SEARCH_MAX);
  return query === "" ? undefined : query;
}
