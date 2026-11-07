import { test } from "node:test";
import assert from "node:assert/strict";
import { draftToTemplate, parseDayList, parseList, toProfile } from "./settings-forms";

test("parseDayList keeps whole positive days, unique, largest first", () => {
  assert.deepEqual(parseDayList("7, 30 15,15, -1, x, 2.5"), [30, 15, 7]);
});

test("parseList trims and drops blanks", () => {
  assert.deepEqual(parseList(" admin, , manager "), ["admin", "manager"]);
});

test("toProfile: blank dates are null, blank text is empty, month is a number", () => {
  const p = toProfile({ registered_name: "Coop", cte_expiry: null, tin: null, fiscal_year_end_month: "6" });
  assert.equal(p.cte_expiry, null);
  assert.equal(p.tin, "");
  assert.equal(p.fiscal_year_end_month, 6);
});

test("draftToTemplate rejects bad JSON and non-objects", () => {
  assert.equal(typeof draftToTemplate({ definition: "{" }), "string");
  assert.equal(typeof draftToTemplate({ definition: "[]" }), "string");
});

test("draftToTemplate parses lists and nulls a blank end date", () => {
  const t = draftToTemplate({
    report_type: "capr",
    name: " CAPR ",
    version: "1",
    status: "active",
    effective_from: "2026-01-01",
    effective_until: "",
    cooperative_types: "Credit, Multipurpose",
    asset_classes: "",
    definition: '{"sections":[]}',
  });
  assert.ok(typeof t !== "string");
  assert.equal(t.name, "CAPR");
  assert.equal(t.effective_until, null);
  assert.deepEqual(t.cooperative_types, ["Credit", "Multipurpose"]);
  assert.deepEqual(t.asset_classes, []);
});
