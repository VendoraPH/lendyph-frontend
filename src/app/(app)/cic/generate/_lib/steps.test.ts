import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicPublicKey, CicSubmission } from "@/types/cic";
import { blockedReason, GENERATE_STEPS, type GenerateState } from "./steps";

const key: CicPublicKey = {
  id: 1,
  fingerprint: "AB12",
  algorithm: null,
  user_id: null,
  status: "valid",
  uploaded_at: "2026-11-01T00:00:00Z",
  uploaded_by: null,
  verified_at: "2026-11-01T01:00:00Z",
  verified_by: null,
  expires_at: null,
};
const ready: GenerateState = {
  referenceDate: "2026-10-31",
  submissionType: 0,
  correctsId: null,
  correctionReason: "",
  settings: { provider_code: "TEST0001", is_mfi: false, contact_name: null, contact_email: null, public_key: key },
  recordCount: 2,
  errorCount: 0,
  submission: null,
  reviewed: false,
  downloaded: false,
  now: new Date("2026-11-28T00:00:00Z"),
};
const submission = (status: CicSubmission["status"]) => ({ status }) as CicSubmission;
const withKey = (k: CicPublicKey | null): GenerateState => ({ ...ready, settings: { ...ready.settings!, public_key: k } });

test("the wizard has eight steps, and review comes between generating and encrypting", () => {
  assert.equal(GENERATE_STEPS.length, 8);
  assert.deepEqual(GENERATE_STEPS.slice(3, 6), ["Generate", "Review", "Encrypt"]);
});

test("a correction names the submission it corrects and why", () => {
  assert.equal(blockedReason(0, ready), null);
  assert.match(blockedReason(0, { ...ready, submissionType: 1 }) ?? "", /corrects/);
  assert.match(blockedReason(0, { ...ready, submissionType: 1, correctsId: 4 }) ?? "", /why/);
  assert.equal(blockedReason(0, { ...ready, submissionType: 1, correctsId: 4, correctionReason: "Rejected" }), null);
});

test("readiness needs the provider code, at least one record and a usable key", () => {
  assert.match(blockedReason(1, { ...ready, settings: { ...ready.settings!, provider_code: null } }) ?? "", /provider code/);
  assert.match(blockedReason(1, { ...ready, recordCount: 0 }) ?? "", /nothing/);
  assert.match(blockedReason(1, withKey(null)) ?? "", /public key/);
  assert.match(blockedReason(1, withKey({ ...key, status: "unverified", verified_at: null })) ?? "", /Verify/);
  assert.match(blockedReason(1, withKey({ ...key, expires_at: "2026-11-01T00:00:00Z" })) ?? "", /expired/);
  assert.equal(blockedReason(1, ready), null);
});

test("any validation error blocks the file", () => {
  assert.notEqual(blockedReason(2, { ...ready, errorCount: 1 }), null);
  assert.equal(blockedReason(2, ready), null);
});

test("the file is generated, reviewed, encrypted and downloaded before it is marked submitted", () => {
  assert.notEqual(blockedReason(3, ready), null);
  assert.equal(blockedReason(3, { ...ready, submission: submission("generated") }), null);
  assert.notEqual(blockedReason(4, { ...ready, submission: submission("generated") }), null);
  assert.equal(blockedReason(4, { ...ready, submission: submission("generated"), reviewed: true }), null);
  assert.notEqual(blockedReason(5, { ...ready, submission: submission("generated") }), null);
  assert.equal(blockedReason(5, { ...ready, submission: submission("encrypted") }), null);
  assert.notEqual(blockedReason(6, ready), null);
  assert.equal(blockedReason(6, { ...ready, downloaded: true }), null);
});
