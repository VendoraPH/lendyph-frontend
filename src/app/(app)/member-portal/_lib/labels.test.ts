import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_STATE_LABELS,
  DISABLE_REASON_LABELS,
  IDENTITY_TYPE_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  STAFF_DISABLE_REASON_LABELS,
  UNKNOWN_LABEL,
  labelOf,
} from "./labels";

test("a key with no words reads Other, never the key", () => {
  assert.equal(labelOf(REQUEST_STATUS_LABELS, "on_hold"), UNKNOWN_LABEL);
  assert.equal(labelOf(REQUEST_STATUS_LABELS, "constructor"), UNKNOWN_LABEL);
  assert.equal(labelOf(REQUEST_STATUS_LABELS, null), "—");
});

test("the ten valid ID keys are the server's, in its words", () => {
  assert.deepEqual(Object.keys(IDENTITY_TYPE_LABELS), [
    "philippine_id", "drivers_license", "passport", "sss", "umid", "voters_id", "postal_id", "prc_id", "tin_id", "others",
  ]);
  assert.equal(IDENTITY_TYPE_LABELS.philippine_id, "Philippine National ID (PhilSys)");
});

test("staff pick only the four reasons the server takes; every stored reason reads in words", () => {
  assert.deepEqual(Object.keys(STAFF_DISABLE_REASON_LABELS), ["member_request", "security_concern", "duplicate_account", "administrative"]);
  assert.equal(DISABLE_REASON_LABELS.deceased, "Member deceased");
});

test("every state, type and status reads in words", () => {
  const maps: Record<string, string>[] = [ACCESS_STATE_LABELS, REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS];
  for (const map of maps) for (const [key, words] of Object.entries(map)) assert.ok(!words.includes("_") && words !== key, key);
  assert.deepEqual([...REQUEST_STATUSES].sort(), Object.keys(REQUEST_STATUS_LABELS).sort());
  assert.equal(REQUEST_STATUS_LABELS.approved, "Waiting for a second approval");
});
