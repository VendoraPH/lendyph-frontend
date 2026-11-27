import { test } from "node:test";
import assert from "node:assert/strict";
import type { CollateralRegisterGroup } from "@/types";
import {
  ALL_TYPES,
  DEFAULT_REGISTER_SORT,
  REGISTER_SEARCH_MAX,
  ariaSortFor,
  excludedValueNote,
  groupStatus,
  groupValue,
  nextRegisterSort,
  pageAfterEmptyResult,
  registerQuery,
  type RegisterView,
} from "./register";

const view = (over: Partial<RegisterView> = {}): RegisterView => ({
  search: "",
  typeFilter: ALL_TYPES,
  sort: DEFAULT_REGISTER_SORT,
  page: 1,
  perPage: 10,
  ...over,
});

const group = (over: Partial<CollateralRegisterGroup> = {}): CollateralRegisterGroup => ({
  borrower_id: 14,
  borrower_name: "Celia Capital",
  collaterals_count: 3,
  tagged_count: 0,
  total_value: 253400.65,
  unknown_count: 0,
  collaterals: [],
  ...over,
});

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

test("the default view asks for page 1 by member name, with no filters", () => {
  assert.deepEqual(registerQuery(view()), {
    sort: "member",
    direction: "asc",
    page: 1,
    per_page: 10,
  });
});

test("a search is trimmed and sent; a blank one is left out entirely", () => {
  assert.equal(registerQuery(view({ search: "  celia  " })).search, "celia");
  assert.equal("search" in registerQuery(view({ search: "   " })), false);
});

test("a search past the server's limit is cut to it rather than refused with a 422", () => {
  const sent = registerQuery(view({ search: "x".repeat(REGISTER_SEARCH_MAX + 20) })).search;
  assert.equal(sent?.length, REGISTER_SEARCH_MAX);
});

test("a type filter goes out as a numeric collateral_type_id; 'all' and junk do not", () => {
  assert.equal(registerQuery(view({ typeFilter: "3" })).collateral_type_id, 3);
  for (const typeFilter of [ALL_TYPES, "", "0", "abc", "1.5"]) {
    assert.equal(
      "collateral_type_id" in registerQuery(view({ typeFilter })),
      false,
      typeFilter,
    );
  }
});

test("sort, direction and paging go out as the view holds them", () => {
  const params = registerQuery(
    view({ sort: { key: "total_value", dir: "desc" }, page: 4, perPage: 50 }),
  );
  assert.equal(params.sort, "total_value");
  assert.equal(params.direction, "desc");
  assert.equal(params.page, 4);
  assert.equal(params.per_page, 50);
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

test("the register opens by member name, A to Z", () => {
  assert.deepEqual(DEFAULT_REGISTER_SORT, { key: "member", dir: "asc" });
});

test("clicking the sorted column flips it, both ways", () => {
  const once = nextRegisterSort(DEFAULT_REGISTER_SORT, "member");
  assert.deepEqual(once, { key: "member", dir: "desc" });
  assert.deepEqual(nextRegisterSort(once, "member"), { key: "member", dir: "asc" });
});

test("a new column starts at the end worth seeing: figures largest first", () => {
  for (const key of ["collaterals", "total_value", "tagged"] as const) {
    assert.deepEqual(nextRegisterSort(DEFAULT_REGISTER_SORT, key), { key, dir: "desc" });
  }
  assert.deepEqual(
    nextRegisterSort({ key: "total_value", dir: "asc" }, "member"),
    { key: "member", dir: "asc" },
  );
});

test("aria-sort names the direction on the sorted column and 'none' on the rest", () => {
  const sort = { key: "tagged", dir: "desc" } as const;
  assert.equal(ariaSortFor(sort, "tagged"), "descending");
  assert.equal(ariaSortFor({ key: "tagged", dir: "asc" }, "tagged"), "ascending");
  assert.equal(ariaSortFor(sort, "member"), "none");
});

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

test("a page that came back empty steps back to the nearest page with rows", () => {
  // Deleted the only member on page 3 of 3: the server now has 2 pages.
  assert.equal(pageAfterEmptyResult(3, 0, 2), 2);
  // `last_page` far below the cursor: straight to it.
  assert.equal(pageAfterEmptyResult(7, 0, 2), 2);
});

test("stepping back always moves at least one page, so it cannot loop", () => {
  // A nonsense `last_page` at or past the cursor still decreases.
  assert.equal(pageAfterEmptyResult(3, 0, 3), 2);
  assert.equal(pageAfterEmptyResult(3, 0, 99), 2);
  assert.equal(pageAfterEmptyResult(2, 0, 0), 1);
});

test("a page with rows, or an empty page 1, stays where it is", () => {
  assert.equal(pageAfterEmptyResult(3, 5, 3), null);
  // An empty first page is an empty register (or filter), not a stale cursor.
  assert.equal(pageAfterEmptyResult(1, 0, 1), null);
});

// ---------------------------------------------------------------------------
// Group figures
// ---------------------------------------------------------------------------

test("a group whose values are all known shows its total, with nothing excluded", () => {
  assert.deepEqual(groupValue(group()), { kind: "amount", total: 253400.65, excluded: 0 });
});

test("a group with some values withheld shows the known total and how many are left out", () => {
  assert.deepEqual(
    groupValue(group({ total_value: 1000, unknown_count: 1 })),
    { kind: "amount", total: 1000, excluded: 1 },
  );
});

test("a group with every value withheld is unavailable, never ₱0.00", () => {
  assert.deepEqual(
    groupValue(group({ collaterals_count: 2, total_value: 0, unknown_count: 2 })),
    { kind: "unavailable" },
  );
});

test("a negative share-capital total is shown as it is, not clamped", () => {
  assert.deepEqual(
    groupValue(group({ collaterals_count: 1, total_value: -300 })),
    { kind: "amount", total: -300, excluded: 0 },
  );
});

test("status reads available, all tagged, or N of M tagged", () => {
  assert.deepEqual(groupStatus(group({ tagged_count: 0 })), {
    tagged: false,
    label: "All available",
  });
  assert.deepEqual(groupStatus(group({ collaterals_count: 2, tagged_count: 2 })), {
    tagged: true,
    label: "All tagged (2)",
  });
  assert.deepEqual(groupStatus(group({ collaterals_count: 3, tagged_count: 1 })), {
    tagged: true,
    label: "1 of 3 tagged",
  });
});

test("the appraised-value note counts what it leaves out, in the right number", () => {
  assert.equal(excludedValueNote(0), null);
  assert.equal(
    excludedValueNote(1),
    "Excludes 1 collateral whose share capital balance could not be read.",
  );
  assert.equal(
    excludedValueNote(4),
    "Excludes 4 collaterals whose share capital balance could not be read.",
  );
});
