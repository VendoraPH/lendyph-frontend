/**
 * The journal register's request and its words. One page of 25 at a time,
 * with every filter on the server; the counts and totals come from the page's
 * `meta.stats` and `meta.totals`.
 */
import { normaliseSearchQuery } from "@/hooks/use-search-page";
import type { JournalPageQuery } from "@/services/accounting.service";
import type { JournalEntry, JournalSource, JournalStatus } from "@/types";

export const JOURNAL_PAGE_SIZE = 25;

/** The Select value meaning "no filter", as `ANY_STATUS` and `ANY_SOURCE` are. */
const ANY = "any";

export interface JournalRegisterFilters {
  from: string;
  to: string;
  branchId: number | undefined;
  status: string;
  source: string;
  search: string;
  page: number;
}

export function journalRegisterParams(filters: JournalRegisterFilters): JournalPageQuery {
  const params: JournalPageQuery = {
    from: filters.from,
    to: filters.to,
    page: filters.page,
    per_page: JOURNAL_PAGE_SIZE,
  };
  if (filters.branchId !== undefined) params.branch_id = filters.branchId;
  if (filters.status !== ANY) params.status = filters.status as JournalStatus;
  if (filters.source !== ANY) params.source = filters.source as JournalSource;
  const search = normaliseSearchQuery(filters.search);
  if (search) params.search = search;
  return params;
}

/** Identifies one request; `reload` asks again for the same filters. */
export function journalRegisterKey(params: JournalPageQuery, reload: number): string {
  return `${JSON.stringify(params)}#${reload}`;
}

/** "3 drafts, 340 posted, 1 reversed", from `meta.stats`. Empty when not sent. */
export function journalStatusCounts(stats: Record<JournalStatus, number> | undefined): string {
  if (!stats) return "";
  const drafts = `${stats.draft} ${stats.draft === 1 ? "draft" : "drafts"}`;
  return `${drafts}, ${stats.posted} posted, ${stats.reversed} reversed`;
}

/** The entry's number, or "Draft #9" for a draft, which is numbered on posting. */
export function journalTitle(entry: Pick<JournalEntry, "id" | "journal_no">): string {
  return entry.journal_no || `Draft #${entry.id}`;
}

const STATUS_WORD: Record<JournalStatus, string> = {
  draft: "draft",
  posted: "posted",
  reversed: "reversed",
};

/**
 * The footer's label for `meta.totals`. With no status filter the totals cover
 * every entry in the register, drafts, reversed entries and their reversals
 * included, so it says so; it is never "posted activity".
 */
export function registerTotalLabel(count: number, status: string): string {
  const noun = count === 1 ? "entry" : "entries";
  const word = STATUS_WORD[status as JournalStatus];
  if (!word) {
    return `Register total: ${count} ${noun} of every status (drafts, posted, reversed entries and their reversals)`;
  }
  return `Register total: ${count} ${word} ${noun}`;
}
