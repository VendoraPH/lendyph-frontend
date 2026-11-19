import { test } from "node:test";
import assert from "node:assert/strict";
import { chartStatus, chartTemplateNotice } from "./chart-status";

const answered = { canView: true, loading: false, unavailable: false, error: null };

test("a chart the server answered with no accounts hasn't been set up", () => {
  assert.equal(chartStatus({ ...answered, rows: 0 }), "not_set_up");
});

test("a chart with accounts is the saved chart", () => {
  assert.equal(chartStatus({ ...answered, rows: 62 }), "saved");
});

test("without chart_of_accounts:view the chart is never read", () => {
  assert.equal(chartStatus({ ...answered, canView: false, rows: null }), "no_access");
});

test("a failed or missing endpoint says nothing about whether a chart exists", () => {
  assert.equal(chartStatus({ ...answered, error: "Server error", rows: null }), "unavailable");
  assert.equal(chartStatus({ ...answered, unavailable: true, rows: null }), "unavailable");
});

test("while loading, the chart's state isn't known", () => {
  assert.equal(chartStatus({ ...answered, loading: true, rows: null }), "loading");
});

test("the template notice says what's true for each state", () => {
  // Flag 12: a 200 with no accounts was read as a missing permission.
  assert.equal(chartTemplateNotice("not_set_up"), "The chart of accounts hasn't been set up yet.");
  assert.match(chartTemplateNotice("no_access") ?? "", /Chart of Accounts: View/);
  assert.match(chartTemplateNotice("unavailable") ?? "", /couldn't be loaded/);
  assert.equal(chartTemplateNotice("saved"), null);
  assert.equal(chartTemplateNotice("loading"), null);
});
