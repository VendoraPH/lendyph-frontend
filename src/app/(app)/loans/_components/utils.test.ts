import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_STATUSES,
  FILTER_TABS,
  allCountFromStats,
  currentCountFromStats,
  loanListParams,
  TAB_VALUES,
  VIRTUAL_TAB_VALUES,
  tabFromParam,
  isoDateOrNull,
  dateOrNull,
  numOrNull,
  clampOneOf,
  offersAutoPay,
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

test("?tab=current is the Current tab, which leaves past-due loans out", () => {
  // The tab sends the API's `current` (released and ongoing, none past grace),
  // and its badge reads `meta.stats.current`. A past-due loan sits in Past Due.
  assert.equal(tabFromParam("current"), "current");
  const current = FILTER_TABS.filter((t) => t.label === "Current");
  assert.deepEqual(current, [{ value: "current", label: "Current" }]);
  assert.ok(!FILTER_TABS.some((t) => t.value === "ongoing" || t.value === "released"));
  assert.ok(!FILTER_TABS.some((t) => t.label === "Released"));
});

test("?tab=active keeps the Active Loans card's set, past-due loans included", () => {
  // The card counts `meta.stats.active`, so what it selects has to be
  // `status=active`, not the narrower Current tab.
  assert.equal(tabFromParam("active"), "active");
  assert.ok(!FILTER_TABS.some((t) => t.value === "active"));
});

test("old ?tab=ongoing and ?tab=released links land on the Current tab", () => {
  assert.equal(tabFromParam("ongoing"), "current");
  assert.equal(tabFromParam("released"), "current");
});

test("the Current count is the server's, and a dash when the server sent none", () => {
  assert.equal(currentCountFromStats({ current: 4, active: 6 }), 4);
  assert.equal(currentCountFromStats({ current: 0, active: 6 }), 0);
  assert.equal(currentCountFromStats({ active: 6 }), null);
});

test("Total Applications never adds the Current roll-up to the statuses it rolls up", () => {
  const stats = { draft: 1, released: 2, ongoing: 3, active: 5, current: 4, past_due: 1 };
  assert.equal(allCountFromStats(stats), 6);
  assert.equal(allCountFromStats({ ...stats, all: 99 }), 99);
});

test("TAB_VALUES lists each value once", () => {
  assert.equal(new Set(TAB_VALUES).size, TAB_VALUES.length);
});

test("?tab=past_due lands on the Past Due tab again", () => {
  // This used to fall back to All, because nothing resolved `status=past_due`
  // and a tab pointing at it read 0 forever. The API resolves it now
  // (Loan::scopePastDue()), so a bookmark from before the tab was removed lands
  // where it always meant to.
  assert.equal(tabFromParam("past_due"), "past_due");
  assert.ok(FILTER_TABS.some((t) => t.value === "past_due"));
});

test("unknown, empty and missing tab values fall back to All", () => {
  assert.equal(tabFromParam("bogus"), "all");
  assert.equal(tabFromParam(""), "all");
  assert.equal(tabFromParam(null), "all");
  assert.equal(tabFromParam("ALL"), "all");
});

test("tabFromParam only ever returns a value the tab strip can show", () => {
  for (const raw of ["past_due", "current", "bogus", "", null, "ongoing", "released", "active"]) {
    assert.ok(TAB_VALUES.includes(tabFromParam(raw)));
  }
});

test("every tab is either a storable status or a resolvable virtual value", () => {
  // Neither `current` nor `past_due` is a storable status. Both ARE resolved
  // server-side, so they are allowed here only by way of VIRTUAL_TAB_VALUES.
  const notStorable = ["current", "past_due"];
  for (const { value } of FILTER_TABS) {
    const virtual = (VIRTUAL_TAB_VALUES as readonly string[]).includes(value);
    assert.ok(
      !notStorable.includes(value) || virtual,
      `${value} is neither a storable status nor a virtual filter`,
    );
  }

  // The active set the KPI fallback SUMS must still be storable statuses only —
  // it adds up `meta.stats` keys, so a phantom member would contribute 0 and
  // quietly understate the card.
  for (const status of ACTIVE_STATUSES) {
    assert.ok(!notStorable.includes(status), `${status} is not a storable status`);
  }
});

test("past_due is not a subset of active, and nothing may assume it is", () => {
  // `past_due` reaches `defaulted` loans, which are collectible but NOT active,
  // so the two counts overlap without either containing the other. If this ever
  // becomes a subset relationship it is a backend change, not a tidy-up here.
  assert.ok(!ACTIVE_STATUSES.includes("defaulted" as never));
  assert.ok((VIRTUAL_TAB_VALUES as readonly string[]).includes("past_due"));
  assert.ok((VIRTUAL_TAB_VALUES as readonly string[]).includes("active"));
});

test("every virtual value is a tab value, so none can be summed as a status", () => {
  // AGGREGATE_STAT_KEYS on the loans page is derived from VIRTUAL_TAB_VALUES.
  // Anything in the tab strip that is a roll-up MUST be listed there, or the
  // "All" total double-counts the rows it overlaps.
  for (const virtual of VIRTUAL_TAB_VALUES) {
    assert.ok(
      virtual === "active" || FILTER_TABS.some((t) => t.value === virtual),
      `${virtual} should be reachable from the UI`,
    );
    assert.ok(TAB_VALUES.includes(virtual));
  }
});

test("ACTIVE_STATUSES tracks the backend constant", () => {
  // Mirrors Loan::ACTIVE_STATUSES. Used only as the fallback when
  // `meta.stats.active` is absent — the filter itself is `status=active`, which
  // the API expands from its own copy. If the backend constant changes, this
  // test is the reminder to change this one with it.
  assert.deepEqual(ACTIVE_STATUSES, ["released", "ongoing"]);
});

const listState = {
  tab: "all" as const,
  page: 1,
  perPage: 10,
  sortKey: "created_at" as const,
  sortDir: "desc" as const,
  search: "",
  productId: null,
  dateFrom: null,
  dateTo: null,
};

test("the Loans list asks for summary rows, which carry no schedules", () => {
  assert.deepEqual(loanListParams(listState), {
    view: "summary",
    page: 1,
    per_page: 10,
    sort: "created_at",
    dir: "desc",
  });
});

test("each tab sends its own status, and All sends none", () => {
  assert.equal(loanListParams({ ...listState, tab: "current" }).status, "current");
  assert.equal(loanListParams({ ...listState, tab: "active" }).status, "active");
  assert.equal(loanListParams({ ...listState, tab: "past_due" }).status, "past_due");
  assert.equal(loanListParams({ ...listState, tab: "draft" }).status, "draft");
  assert.equal("status" in loanListParams(listState), false);
});

test("the filters go up only when they are set", () => {
  assert.deepEqual(
    loanListParams({
      ...listState,
      search: "Ana",
      productId: 3,
      dateFrom: "2026-11-01",
      dateTo: "2026-11-05",
    }),
    {
      view: "summary",
      page: 1,
      per_page: 10,
      sort: "created_at",
      dir: "desc",
      search: "Ana",
      loan_product_id: 3,
      date_from: "2026-11-01",
      date_to: "2026-11-05",
    },
  );
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

test("every Current loan offers auto-pay, released or ongoing", () => {
  // Both read "Current" and the backend's auto-pay covers both.
  assert.equal(offersAutoPay("released"), true);
  assert.equal(offersAutoPay("ongoing"), true);
  for (const status of ["draft", "for_review", "approved", "completed", "defaulted", "restructured", "void", "current", "", null, undefined]) {
    assert.equal(offersAutoPay(status), false, String(status));
  }
});
