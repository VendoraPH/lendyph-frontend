import { test } from "node:test";
import assert from "node:assert/strict";
import * as labels from "./labels";
import { NONE, OTHER, labelOf, toneOf } from "./labels";

test("a key the map knows reads its words", () => {
  assert.equal(labelOf(labels.LOAN_STATUS, "past_due"), "Past Due");
  assert.equal(labelOf(labels.REQUEST_STATUS, "approved"), "Waiting for a second approval");
});

test("an unknown key reads Other, never the raw key", () => {
  assert.equal(labelOf(labels.LOAN_STATUS, "written_off"), OTHER);
  assert.equal(labelOf(labels.REQUEST_TYPE, "loan_application"), OTHER);
  assert.equal(labelOf(labels.SAVINGS_TRANSACTION, "constructor"), OTHER, "inherited object keys are not labels");
});

test("a missing key reads a dash", () => {
  assert.equal(labelOf(labels.MEMBER_TYPE, null), NONE);
  assert.equal(labelOf(labels.MEMBER_TYPE, undefined), NONE);
  assert.equal(labelOf(labels.MEMBER_TYPE, ""), NONE);
});

test("an unknown tone is muted", () => {
  assert.equal(toneOf(labels.LOAN_STATUS_TONE, "past_due"), "danger");
  assert.equal(toneOf(labels.LOAN_STATUS_TONE, "something_new"), "muted");
  assert.equal(toneOf(labels.LOAN_STATUS_TONE, null), "muted");
});

test("released and ongoing loans both read Current (round m6)", () => {
  assert.equal(labelOf(labels.LOAN_STATUS, "released"), "Current");
  assert.equal(labelOf(labels.LOAN_STATUS, "ongoing"), "Current");
});

test("every word in every map is written out, with no underscores", () => {
  for (const [name, map] of Object.entries(labels)) {
    if (typeof map !== "object" || name === "TONE_CLASS" || name.endsWith("_TONE")) continue;
    for (const [key, words] of Object.entries(map as Record<string, string>)) {
      assert.ok(words.trim().length > 0, `${name}.${key}`);
      assert.ok(!words.includes("_"), `${name}.${key} reads "${words}"`);
    }
  }
});

test("every tone map only names keys its label map has", () => {
  const pairs: [Record<string, string>, Record<string, string>][] = [
    [labels.LOAN_STATUS, labels.LOAN_STATUS_TONE],
    [labels.SCHEDULE_STATUS, labels.SCHEDULE_STATUS_TONE],
    [labels.SAVINGS_STATUS, labels.SAVINGS_STATUS_TONE],
    [labels.TIME_DEPOSIT_STATUS, labels.TIME_DEPOSIT_STATUS_TONE],
    [labels.MEMBER_STATUS, labels.MEMBER_STATUS_TONE],
    [labels.STANDING_STATUS, labels.STANDING_STATUS_TONE],
    [labels.REQUEST_STATUS, labels.REQUEST_STATUS_TONE],
    [labels.LOGIN_OUTCOME, labels.LOGIN_OUTCOME_TONE],
  ];
  for (const [words, tones] of pairs) {
    assert.deepEqual(Object.keys(tones).sort(), Object.keys(words).sort());
  }
});

test("the request statuses and types are the server's (backend PortalRequest)", () => {
  assert.deepEqual(Object.keys(labels.REQUEST_STATUS).sort(), [
    "approved",
    "cancelled",
    "completed",
    "expired",
    "need_info",
    "rejected",
    "submitted",
    "under_review",
  ]);
  assert.deepEqual(Object.keys(labels.REQUEST_TYPE).sort(), ["profile_update", "savings_opening", "savings_withdrawal"]);
  assert.deepEqual(Object.keys(labels.PAYOUT_METHOD).sort(), ["bank_transfer", "cash_pickup", "gcash"]);
});
