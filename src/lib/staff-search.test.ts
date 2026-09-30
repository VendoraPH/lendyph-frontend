import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  STAFF_SEARCH_MAX_LENGTH,
  isStaffListForbidden,
  normaliseStaffQuery,
  staffEmptyMessage,
  staffSearchStatus,
  viewStaffSearch,
  type StaffPage,
  type StaffSearchState,
  type StaffSearchView,
} from "./staff-search";

function view(over: Partial<StaffSearchView> = {}): StaffSearchView {
  return { query: "", shown: 20, total: 20, pending: false, failed: false, ...over };
}

function answer(query: string, names: string[], total = names.length): StaffPage {
  return { query, rows: names.map((full_name, i) => ({ id: i + 1, full_name })), total };
}

function state(over: Partial<StaffSearchState> = {}): StaffSearchState {
  return {
    query: "",
    asked: "",
    failedQuery: null,
    page: null,
    firstPage: null,
    forbidden: false,
    ...over,
  };
}

const FIRST = answer("", ["Ana Cruz", "Ben Reyes"], 57);
const MA = answer("ma", ["Maria Santos"]);

describe("viewStaffSearch", () => {
  test("before the first answer arrives it is loading, with nothing listed", () => {
    const { rows, view: v } = viewStaffSearch(state());
    assert.deepEqual(rows, []);
    assert.equal(v.pending, true);
    assert.equal(staffSearchStatus(v), "Loading staff…");
  });

  test("the kept first page answers the empty query without waiting", () => {
    const { rows, view: v } = viewStaffSearch(state({ page: MA, firstPage: FIRST }));
    assert.equal(rows, FIRST.rows);
    assert.equal(v.pending, false);
    assert.equal(v.total, 57);
  });

  test("rows from an older query stay up, flagged pending, while typing settles", () => {
    const { rows, view: v } = viewStaffSearch(state({ query: "mar", asked: "ma", page: MA }));
    assert.equal(rows, MA.rows);
    assert.equal(v.pending, true);
    assert.equal(staffSearchStatus(v), "Searching…");
    assert.equal(staffEmptyMessage(v), null);
  });

  test("an answer to a query the user has typed past is still pending", () => {
    const { view: v } = viewStaffSearch(state({ query: "ma", asked: "ma", page: FIRST, firstPage: FIRST }));
    assert.equal(v.pending, true);
  });

  test("the answer to the typed query settles it", () => {
    const { rows, view: v } = viewStaffSearch(state({ query: " ma ", asked: "ma", page: MA, firstPage: FIRST }));
    assert.equal(rows, MA.rows);
    assert.equal(v.pending, false);
    assert.equal(v.query, "ma");
  });

  test("a failure lists nothing, until a keystroke makes it a retry", () => {
    const failed = viewStaffSearch(state({ query: "ma", asked: null, failedQuery: "ma", page: FIRST }));
    assert.deepEqual(failed.rows, []);
    assert.equal(failed.view.failed, true);
    assert.equal(failed.view.pending, false);

    const retrying = viewStaffSearch(state({ query: "mar", asked: null, failedQuery: "ma", page: FIRST }));
    assert.equal(retrying.view.failed, false);
    assert.equal(retrying.view.pending, true);
  });

  test("forbidden is never pending, so nothing claims to be loading", () => {
    const { view: v } = viewStaffSearch(state({ forbidden: true }));
    assert.equal(v.pending, false);
  });

  test("an empty list keeps one identity across renders", () => {
    assert.equal(viewStaffSearch(state()).rows, viewStaffSearch(state()).rows);
  });
});

describe("normaliseStaffQuery", () => {
  test("trims and collapses inner whitespace, so 'first last' can match", () => {
    assert.equal(normaliseStaffQuery("  Juan \t  Dela  "), "Juan Dela");
  });

  test("blank input is the empty query", () => {
    assert.equal(normaliseStaffQuery("   "), "");
  });

  test("never sends more than the server accepts, nor a trailing space", () => {
    const cut = normaliseStaffQuery(`${"a".repeat(STAFF_SEARCH_MAX_LENGTH - 1)} b`);
    assert.equal(cut, "a".repeat(STAFF_SEARCH_MAX_LENGTH - 1));
    assert.ok(normaliseStaffQuery("z".repeat(250)).length <= STAFF_SEARCH_MAX_LENGTH);
  });
});

describe("isStaffListForbidden", () => {
  test("only a 403 is forbidden", () => {
    assert.equal(isStaffListForbidden({ response: { status: 403 } }), true);
    for (const status of [401, 404, 422, 500]) {
      assert.equal(isStaffListForbidden({ response: { status } }), false, `status ${status}`);
    }
  });

  test("a network error or a non-HTTP throw is not forbidden", () => {
    assert.equal(isStaffListForbidden(new Error("Network Error")), false);
    assert.equal(isStaffListForbidden(null), false);
    assert.equal(isStaffListForbidden(undefined), false);
  });
});

describe("staffSearchStatus", () => {
  test("says how many there are when the page is short of the total", () => {
    assert.equal(
      staffSearchStatus(view({ shown: 20, total: 57 })),
      "Showing 20 of 57 — type a name to narrow.",
    );
    assert.equal(
      staffSearchStatus(view({ query: "re", shown: 20, total: 31 })),
      "Showing 20 of 31 — keep typing to narrow.",
    );
  });

  test("says nothing when every match is on screen", () => {
    assert.equal(staffSearchStatus(view({ shown: 7, total: 7 })), "");
  });

  test("while a search is out, says so rather than counting stale rows", () => {
    assert.equal(staffSearchStatus(view({ pending: true, shown: 0, total: 0 })), "Loading staff…");
    assert.equal(staffSearchStatus(view({ pending: true, shown: 20, total: 57 })), "Searching…");
  });

  test("a failure asks for a keystroke to retry", () => {
    assert.equal(
      staffSearchStatus(view({ failed: true, shown: 0, total: 0 })),
      "Couldn't load staff. Keep typing to try again.",
    );
  });

  test("typing after a failure shows the retry, not the old error", () => {
    assert.equal(staffSearchStatus(view({ failed: true, pending: true, shown: 0 })), "Loading staff…");
  });
});

describe("staffEmptyMessage", () => {
  test("names the query that found nobody", () => {
    assert.equal(staffEmptyMessage(view({ query: "zed", shown: 0, total: 0 })), "No active staff match “zed”.");
    assert.equal(staffEmptyMessage(view({ shown: 0, total: 0 })), "No active staff found.");
  });

  test("stays quiet while loading, after a failure, or when there are rows", () => {
    assert.equal(staffEmptyMessage(view({ shown: 0, pending: true })), null);
    assert.equal(staffEmptyMessage(view({ shown: 0, failed: true })), null);
    assert.equal(staffEmptyMessage(view({ shown: 3, total: 3 })), null);
  });
});
