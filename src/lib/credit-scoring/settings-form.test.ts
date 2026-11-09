import { test } from "node:test";
import assert from "node:assert/strict";
import { POLICY_FIGURES, settingsBody, settingsFormFrom } from "./settings-form";
import type { CreditScoringSettings } from "@/types/credit-scoring";

const settings: CreditScoringSettings = {
  privacy_notice: "We use your loan records to score.",
  score_model_version: "1.0",
  notice_version: 1,
  confidence_definitions: [],
  hard_flag_definitions: [],
  dsr_manageable_max: 35,
  dsr_caution_max: 50.125,
  capacity_share: 40,
  max_active_loans: 3,
  hard_past_due_days: 30,
  decline_alert_points: 10,
};

test("the six policy figures are offered, each once", () => {
  assert.deepEqual(POLICY_FIGURES.map((f) => f.key), [
    "dsr_manageable_max",
    "dsr_caution_max",
    "capacity_share",
    "max_active_loans",
    "hard_past_due_days",
    "decline_alert_points",
  ]);
});

test("rates start as the server sent them, never rounded", () => {
  const form = settingsFormFrom(settings);
  assert.equal(form.dsr_caution_max, "50.125");
  assert.equal(form.max_active_loans, "3");
});

test("the body sends the notice and the figures as typed, never the version or definitions", () => {
  const form = { ...settingsFormFrom(settings), dsr_manageable_max: "35.1234 " };
  const body = settingsBody(form);
  assert.deepEqual(body, {
    privacy_notice: "We use your loan records to score.",
    dsr_manageable_max: "35.1234",
    dsr_caution_max: "50.125",
    capacity_share: "40",
    max_active_loans: "3",
    hard_past_due_days: "30",
    decline_alert_points: "10",
  });
  assert.equal("score_model_version" in body, false);
  assert.equal("notice_version" in body, false);
});
