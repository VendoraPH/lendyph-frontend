import type { DrainResult } from "@/lib/paginate";
import {
  memberSearchParams,
  memberSearchStatus,
  normaliseMemberQuery,
} from "@/hooks/use-member-search";
import { borrowerService } from "@/services/borrower.service";
import { gcashService } from "@/services/gcash.service";
import {
  EMPTY_PARTY_LIST,
  memberOption,
  walkInOption,
  type GCashPartyListState,
} from "./party-options";

export interface GCashPartyLists {
  members: GCashPartyListState;
  nonMembers: GCashPartyListState;
}

function listState<T>(
  drain: DrainResult<T>,
  toOption: (row: T) => GCashPartyListState["options"][number],
): GCashPartyListState {
  return {
    options: drain.rows.map(toOption),
    shortfall: drain.truncated
      ? { shown: drain.rows.length, total: drain.total }
      : null,
  };
}

/**
 * One page of members for one search, and nothing more: a page that leaves some
 * out is the normal answer, so it says so in the line under the list rather than
 * as a list cut short.
 */
async function loadMemberPage(query: string): Promise<GCashPartyListState> {
  const response = await borrowerService.list(memberSearchParams(query));
  const rows = response.data ?? [];
  return {
    options: rows.map(memberOption),
    shortfall: null,
    status: memberSearchStatus({
      query,
      shown: rows.length,
      total: response.meta?.total ?? rows.length,
      pending: false,
      failed: false,
    }),
  };
}

/**
 * Both sides of the GCash counter for one search, searched on the server.
 *
 * The browser used to filter rows it had already loaded, so it could only find
 * walk-ins on the pages it held, and knew nothing of the server's normalised
 * ID match (`12345678` finding `1234-5678`). Each search now asks the server:
 * walk-ins by name, mobile or ID number (GCashNonMemberController::index),
 * members by the same search the Members tab uses (Borrower::scopeSearch).
 *
 * Members come one page at a time (the first 25 before typing): a
 * drain stopped at 2,000, and nobody can pick a member who isn't on the list.
 * Walk-ins are still drained, because there are few: the matches are the whole
 * answer, and a cut-off list is reported as a shortfall rather than shown as
 * complete. An empty search drains every walk-in.
 */
export async function loadGCashPartyLists({
  search,
  canListMembers,
}: {
  search: string;
  /** Members need `borrowers:view`; without it only walk-ins are asked for. */
  canListMembers: boolean;
}): Promise<GCashPartyLists> {
  const query = normaliseMemberQuery(search);
  const [members, nonMemberDrain] = await Promise.all([
    // members_only: every option here can be transacted for, so pending and
    // rejected applicants must not be selectable at all.
    canListMembers ? loadMemberPage(query) : EMPTY_PARTY_LIST,
    gcashService.listAllNonMembers({ search: query || undefined }),
  ]);
  return { members, nonMembers: listState(nonMemberDrain, walkInOption) };
}
