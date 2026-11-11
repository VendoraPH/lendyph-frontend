import { test } from "node:test";
import assert from "node:assert/strict";
import type { CdaSettings } from "@/types/cda";
import { draftToSettings, draftToTemplate, parseDayList, parseKeyList, settingsToDraft, templateToDraft, toProfile } from "./settings-forms";

const SETTINGS: CdaSettings = {
  annual_deadline_days: 120,
  mediation_deadline_days: 30,
  reminder_days: [30, 15, 7, 3],
  required_trainings: { chairperson: ["basic_coop_course", "governance"] },
  asset_class_thresholds: { micro: "3000000.00", small: "15000000.00", medium: "100000000.00" },
  updated_by: null,
  updated_at: null,
};

test("settings round-trip, with the asset bounds sent exactly as typed", () => {
  const draft = settingsToDraft(SETTINGS);
  assert.equal(draft.reminder_days, "30, 15, 7, 3");
  assert.equal(draft.trainings.chairperson, "basic_coop_course, governance");
  const result = draftToSettings(draft);
  assert.ok("body" in result);
  assert.deepEqual(result.body.asset_class_thresholds, SETTINGS.asset_class_thresholds);
  assert.deepEqual(result.body.reminder_days, [30, 15, 7, 3]);
  assert.deepEqual(result.body.required_trainings, { chairperson: ["basic_coop_course", "governance"] });
  assert.equal(result.body.annual_deadline_days, 120);
});

test("days that aren't whole numbers and blank bounds are named, not guessed", () => {
  const result = draftToSettings({ ...settingsToDraft(SETTINGS), annual_deadline_days: "12o", reminder_days: "30, x", micro: "" });
  assert.ok("invalid" in result);
  assert.deepEqual(result.invalid, ["Annual reports due (days after Dec 31)", "Reminder days", "Asset size bounds"]);
});

test("lists parse the way they are typed", () => {
  assert.deepEqual(parseDayList("30 15,15 7"), [30, 15, 7]);
  assert.equal(parseDayList("3.5"), null);
  assert.deepEqual(parseKeyList(" a , ,b"), ["a", "b"]);
});

test("the profile sends blanks as null and the CTE status as picked", () => {
  const body = toProfile({ cte_status: "valid", tin: "", satellite_offices: "2" });
  assert.equal(body.cte_status, "valid");
  assert.equal(body.tin, null);
  assert.equal(body.satellite_offices, 2);
});

test("a template's definition must be a JSON object", () => {
  const draft = templateToDraft(null);
  assert.equal(typeof draftToTemplate({ ...draft, definition: "[1]" }), "string");
  assert.equal(typeof draftToTemplate({ ...draft, definition: "{" }), "string");
  const ok = draftToTemplate({ ...draft, report_type: "capr", name: "CAPR", version: "2027.1", effective_from: "2027-01-01", asset_classes: "micro, small" });
  assert.ok(typeof ok !== "string");
  assert.deepEqual(ok.asset_classes, ["micro", "small"]);
  assert.equal(ok.effective_until, null);
});
