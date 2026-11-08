import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Borrower } from "@/types";
import {
  MEMBER_PAGE_SIZE,
  MEMBER_SEARCH_DEBOUNCE_MS,
  fetchMemberPage,
  memberEmptyMessage,
  memberSearchParams,
  memberSearchStatus,
  normaliseMemberQuery,
  rememberMembers,
  selectableMembers,
  toMemberOption,
  viewMemberSearch,
  type MemberPage,
} from "./use-member-search";

const borrower = (id: number, name = `Member ${id}`): Borrower =>
  ({ id, full_name: name, borrower_code: `M-${id}` }) as Borrower;

const page = (query: string, ids: number[], total = ids.length): MemberPage => ({
  query,
  rows: ids.map((id) => toMemberOption(borrower(id))),
  total,
});

describe("what is asked of the server", () => {
  test("the first 25 members before typing", () => {
    assert.equal(MEMBER_PAGE_SIZE, 25);
    assert.deepEqual(memberSearchParams(""), { members_only: 1, per_page: 25 });
  });

  test("members only, 25 at a time, when searching", () => {
    assert.deepEqual(memberSearchParams("santos"), {
      members_only: 1,
      per_page: 25,
      search: "santos",
    });
  });

  test("typing has to pause for 300 ms", () => {
    assert.equal(MEMBER_SEARCH_DEBOUNCE_MS, 300);
  });

  test("what was typed is trimmed and inner spaces collapse", () => {
    assert.equal(normaliseMemberQuery("  Maria   Dela  Cruz "), "Maria Dela Cruz");
  });

  // The pickers used to drain the whole membership, and stopped at 2,000.
  test("a search is one request, however many pages match", async () => {
    const asked: Record<string, unknown>[] = [];
    const answer = await fetchMemberPage(async (params) => {
      asked.push(params);
      return {
        data: [borrower(1)],
        meta: { current_page: 1, last_page: 200, per_page: 25, total: 5000 },
      };
    }, "maria");

    assert.equal(asked.length, 1);
    assert.deepEqual(asked[0], { members_only: 1, per_page: 25, search: "maria" });
    assert.equal(answer.total, 5000);
    assert.equal(answer.query, "maria");
    assert.deepEqual(answer.rows, [{ id: 1, full_name: "Member 1", borrower_code: "M-1" }]);
  });

  test("an answer with no meta counts its own rows", async () => {
    const answer = await fetchMemberPage(async () => ({ data: [borrower(1), borrower(2)] }), "");
    assert.equal(answer.total, 2);
  });
});

describe("what the picker shows", () => {
  const state = {
    query: "",
    asked: "" as string | null,
    failedQuery: null as string | null,
    page: null as MemberPage | null,
    firstPage: null as MemberPage | null,
  };

  test("loading before the first answer", () => {
    const { rows, view } = viewMemberSearch(state);
    assert.deepEqual(rows, []);
    assert.equal(view.pending, true);
    assert.equal(memberSearchStatus(view), "Loading members…");
    assert.equal(memberEmptyMessage(view), null);
  });

  test("the first page, saying when there are more", () => {
    const first = page("", [1, 2], 5000);
    const { rows, view } = viewMemberSearch({ ...state, page: first, firstPage: first });
    assert.equal(rows.length, 2);
    assert.equal(view.pending, false);
    assert.equal(memberSearchStatus(view), "Showing 2 of 5000. Type a name to narrow.");
  });

  test("old rows stay up, marked as searching, until the typed query is answered", () => {
    const first = page("", [1, 2]);
    const { rows, view } = viewMemberSearch({
      ...state,
      query: "mar",
      asked: "",
      page: first,
      firstPage: first,
    });
    assert.equal(rows.length, 2);
    assert.equal(view.pending, true);
    assert.equal(memberSearchStatus(view), "Searching…");
  });

  test("the answer for the typed query", () => {
    const answered = page("maria", [9], 40);
    const { rows, view } = viewMemberSearch({
      ...state,
      query: "maria",
      asked: "maria",
      page: answered,
      firstPage: page("", [1]),
    });
    assert.deepEqual(rows.map((row) => row.id), [9]);
    assert.equal(memberSearchStatus(view), "Showing 1 of 40. Keep typing to narrow.");
  });

  test("a query matching nobody says so", () => {
    const answered = page("zzz", []);
    const { view } = viewMemberSearch({ ...state, query: "zzz", asked: "zzz", page: answered });
    assert.equal(memberEmptyMessage(view), "No member matches “zzz”.");
    assert.equal(memberSearchStatus(view), "");
  });

  test("no members at all says so", () => {
    const answered = page("", []);
    const { view } = viewMemberSearch({ ...state, page: answered, firstPage: answered });
    assert.equal(memberEmptyMessage(view), "No member found.");
  });

  test("a failed search is not an empty one", () => {
    const { rows, view } = viewMemberSearch({
      ...state,
      query: "maria",
      asked: null,
      failedQuery: "maria",
      page: page("", [1]),
    });
    assert.deepEqual(rows, []);
    assert.equal(view.failed, true);
    assert.equal(memberEmptyMessage(view), null);
    assert.equal(memberSearchStatus(view), "Couldn't load members. Keep typing to try again.");
  });
});

describe("the pickers' rows", () => {
  test("a member picked elsewhere on the form is not offered", () => {
    const rows = [1, 2, 3, 4].map((id) => toMemberOption(borrower(id)));
    assert.deepEqual(
      selectableMembers(rows, [1, null, 3]).map((row) => row.id),
      [2, 4],
    );
  });

  test("a picked member stays known after the search moves on", () => {
    const known = rememberMembers({}, [toMemberOption(borrower(1))]);
    const later = rememberMembers(known, [toMemberOption(borrower(2))]);
    assert.equal(later[1]?.full_name, "Member 1");
    assert.equal(later[2]?.full_name, "Member 2");
  });

  test("a co-maker from a saved loan has a name but no code", () => {
    const known = rememberMembers({}, [{ id: 8, full_name: "Rosa Lim" }]);
    assert.deepEqual(known[8], { id: 8, full_name: "Rosa Lim" });
  });
});
