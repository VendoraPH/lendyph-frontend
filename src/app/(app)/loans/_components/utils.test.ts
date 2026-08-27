import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_STATUSES,
  FILTER_TABS,
  TAB_VALUES,
  tabFromParam,
  isoDateOrNull,
  dateOrNull,
  numOrNull,
  clampOneOf,
} from "./utils";

// The loans screen keeps its entire state in the URL, so `?tab=` is a public,
// shareable contract — bookmarks and pasted links outlive any tab we rename or
// remove. These lock that contract down.

test("a live tab value resolves to itself", () => {
  for (const { value } of FILTER_TABS) {
    assert.equal(tabFromParam(value), value);
  }
  assert.equal(tabFromParam("active"), "active");
});

test("legacy ?tab=current lands on the tab it meant, not on All", () => {
  // The Current tab was renamed, not removed: it filtered `status=current`,
  // which no row can hold, and now filters `ongoing`.
  assert.equal(tabFromParam("current"), "ongoing");
});

test("the removed ?tab=past_due falls back to All", () => {
  // No successor status exists, so a bookmarked Past Due link has to land
  // somewhere real rather than on a selected-but-invisible tab.
  assert.equal(tabFromParam("past_due"), "all");
});

test("unknown, empty and missing tab values fall back to All", () => {
  assert.equal(tabFromParam("bogus"), "all");
  assert.equal(tabFromParam(""), "all");
  assert.equal(tabFromParam(null), "all");
  assert.equal(tabFromParam("ALL"), "all");
});

test("tabFromParam only ever returns a value the tab strip can show", () => {
  for (const raw of ["past_due", "current", "bogus", "", null, "ongoing", "active"]) {
    assert.ok(TAB_VALUES.includes(tabFromParam(raw)));
  }
});

test("no tab points at a status the loans.status enum has no member for", () => {
  const dead = ["current", "past_due"];
  for (const { value } of FILTER_TABS) {
    assert.ok(!dead.includes(value), `${value} is not a storable status`);
  }
  // The same two must not be claimed by the active set the KPI fallback sums.
  for (const status of ACTIVE_STATUSES) {
    assert.ok(!dead.includes(status), `${status} is not a storable status`);
  }
});

test("ACTIVE_STATUSES tracks the backend constant", () => {
  // Mirrors Loan::ACTIVE_STATUSES. Used only as the fallback when
  // `meta.stats.active` is absent — the filter itself is `status=active`, which
  // the API expands from its own copy. If the backend constant changes, this
  // test is the reminder to change this one with it.
  assert.deepEqual(ACTIVE_STATUSES, ["released", "ongoing"]);
});

test("isoDateOrNull keeps a valid day and rejects anything else", () => {
  assert.equal(isoDateOrNull("2024-02-29"), "2024-02-29");
  assert.equal(isoDateOrNull("not-a-date"), null);
  assert.equal(isoDateOrNull("13/13/2024"), null);
  assert.equal(isoDateOrNull(""), null);
  assert.equal(isoDateOrNull(null), null);
});

test("dateOrNull parses at local midnight, not UTC", () => {
  // Parsing "2024-03-01" as UTC would render as Feb 29 for anyone west of
  // Greenwich, silently shifting the date the operator picked.
  const d = dateOrNull("2024-03-01");
  assert.ok(d instanceof Date);
  assert.equal(d!.getFullYear(), 2024);
  assert.equal(d!.getMonth(), 2);
  assert.equal(d!.getDate(), 1);
});

test("numOrNull rejects non-finite and empty input", () => {
  assert.equal(numOrNull("3"), 3);
  assert.equal(numOrNull("abc"), null);
  assert.equal(numOrNull("1e999"), null);
  assert.equal(numOrNull(""), null);
  assert.equal(numOrNull(null), null);
});

test("clampOneOf falls back rather than passing a value through", () => {
  assert.equal(clampOneOf("asc", ["asc", "desc"], "desc"), "asc");
  assert.equal(clampOneOf("sideways", ["asc", "desc"], "desc"), "desc");
  assert.equal(clampOneOf(999, [10, 20, 50], 10), 10);
});
