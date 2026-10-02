import { emptyDrain, type DrainResult } from "@/lib/paginate";
import { borrowerService } from "@/services/borrower.service";
import { gcashService } from "@/services/gcash.service";
import type { Borrower } from "@/types";
import {
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
 * Both sides of the GCash counter for one search, searched on the server.
 *
 * The browser used to filter rows it had already loaded, so it could only find
 * walk-ins on the pages it held, and knew nothing of the server's normalised
 * ID match (`12345678` finding `1234-5678`). Each search now asks the server:
 * walk-ins by name, mobile or ID number (GCashNonMemberController::index),
 * members by the same search the Members tab uses (Borrower::scopeSearch).
 *
 * Still drained, not paged: the matches are the whole answer, and a cut-off
 * list is reported as a shortfall rather than shown as complete. An empty
 * search drains everyone, as the picker did before.
 */
export async function loadGCashPartyLists({
  search,
  canListMembers,
}: {
  search: string;
  /** Members need `borrowers:view`; without it only walk-ins are asked for. */
  canListMembers: boolean;
}): Promise<GCashPartyLists> {
  const term = search.trim() || undefined;
  const [memberDrain, nonMemberDrain] = await Promise.all([
    // members_only: every option here can be transacted for, so pending and
    // rejected applicants must not be selectable at all.
    canListMembers
      ? borrowerService.listAll({ members_only: 1, search: term })
      : emptyDrain<Borrower>(),
    gcashService.listAllNonMembers({ search: term }),
  ]);
  return {
    members: listState(memberDrain, memberOption),
    nonMembers: listState(nonMemberDrain, walkInOption),
  };
}
