import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicSubmission } from "@/types/cic";
import { blockedReason, GENERATE_STEPS, type GenerateState } from "./steps";

const ready: GenerateState = {
  referenceDate: "2026-10-31",
  submissionType: 0,
  correctsId: null,
  settings: {
    provider_code: "TEST0001",
    is_mfi: false,
    contact_name: null,
    contact_email: null,
    public_key: { fingerprint: "AB", algorithm: null, user_id: null, uploaded_at: "", uploaded_by: null, expires_at: null },
  },
  recordCount: 2,
  errorCount: 0,
  submission: null,
  downloaded: false,
};
const submission = (status: CicSubmission["status"]) => ({ status }) as CicSubmission;

test("the wizard has the eight steps of the spec", () => {
  assert.equal(GENERATE_STEPS.length, 8);
});

test("a correction must name the submission it corrects", () => {
  assert.equal(blockedReason(0, ready), null);
  assert.match(blockedReason(0, { ...ready, submissionType: 1 }) ?? "", /corrects/);
  assert.equal(blockedReason(0, { ...ready, submissionType: 1, correctsId: 4 }), null);
});

test("readiness needs the provider code, CIC's public key and at least one record", () => {
  assert.match(blockedReason(1, { ...ready, settings: { ...ready.settings!, provider_code: null } }) ?? "", /provider code/);
  assert.match(blockedReason(1, { ...ready, settings: { ...ready.settings!, public_key: null } }) ?? "", /public key/);
  assert.match(blockedReason(1, { ...ready, recordCount: 0 }) ?? "", /nothing/);
  assert.equal(blockedReason(1, ready), null);
});

test("any validation error blocks the file", () => {
  assert.notEqual(blockedReason(2, { ...ready, errorCount: 1 }), null);
  assert.equal(blockedReason(2, ready), null);
});

test("the file must be generated, encrypted and downloaded before it is marked submitted", () => {
  assert.notEqual(blockedReason(4, ready), null);
  assert.equal(blockedReason(4, { ...ready, submission: submission("generated") }), null);
  assert.notEqual(blockedReason(5, { ...ready, submission: submission("generated") }), null);
  assert.equal(blockedReason(5, { ...ready, submission: submission("encrypted") }), null);
  assert.notEqual(blockedReason(6, ready), null);
  assert.equal(blockedReason(6, { ...ready, downloaded: true }), null);
});
