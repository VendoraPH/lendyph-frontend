import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicSubmissionDetail } from "@/types/cic";
import { generateStepErrors, generateSteps, type GenerateState } from "./steps";

const detail = (over: Partial<CicSubmissionDetail> = {}) =>
  ({
    status: "generated",
    active_key: { usable: true, unusable_reason: null },
    validation: { errors: 0, warnings: 0, top_issues: [] },
    encryption: { gpg_available: true },
    actions: { encrypt: true, download: false, mark_submitted: false, acknowledge: false, correct: false },
    ...over,
  }) as CicSubmissionDetail;

const start: GenerateState = {
  correction: false,
  captureId: null,
  correctionReason: "",
  submission: null,
  confirmed: false,
  downloaded: false,
};

test("the wizard reviews the file between generating and encrypting it", () => {
  for (const correction of [false, true]) {
    assert.deepEqual(
      generateSteps(correction).map((s) => s.id),
      ["capture", "generate", "review", "encrypt", "download", "submit"],
    );
  }
});

test("a correction's capture step speaks of the correction capture, never the month-end one", () => {
  const [standard] = generateSteps(false);
  const [correction] = generateSteps(true);
  assert.match(standard.description ?? "", /month-end capture/);
  assert.equal(correction.title, "Correction Capture");
  assert.match(correction.description ?? "", /correction capture of the capture it corrects/);
  assert.doesNotMatch(`${correction.title} ${correction.description}`, /month-end/i);
});

test("a file is built only from a capture, and a correction says why", () => {
  assert.notEqual(generateStepErrors("capture", start), true);
  assert.equal(generateStepErrors("capture", { ...start, captureId: 3 }), true);
  assert.deepEqual(generateStepErrors("capture", { ...start, correction: true, captureId: 3 }), {
    correction_reason: "Say why the correction is sent.",
  });
  assert.equal(generateStepErrors("capture", { ...start, correction: true, captureId: 3, correctionReason: "Rejected" }), true);
});

test("encrypting waits for the explicit confirmation and the server's usable key", () => {
  const s = { ...start, captureId: 3, submission: detail() };
  assert.notEqual(generateStepErrors("review", s), true);
  assert.equal(generateStepErrors("review", { ...s, confirmed: true }), true);
  const unusable = detail({ active_key: { usable: false, unusable_reason: "CIC's key has expired." } as CicSubmissionDetail["active_key"] });
  assert.deepEqual(generateStepErrors("review", { ...s, submission: unusable, confirmed: true }), {
    confirmed: "CIC's key has expired.",
  });
  assert.notEqual(generateStepErrors("review", { ...s, submission: detail({ actions: { ...detail().actions, encrypt: false } }), confirmed: true }), true);
});

test("the file is encrypted and downloaded before it is marked submitted", () => {
  const s = { ...start, captureId: 3, submission: detail() };
  assert.notEqual(generateStepErrors("generate", start), true);
  assert.equal(generateStepErrors("generate", s), true);
  assert.notEqual(generateStepErrors("encrypt", s), true);
  const encrypted = { ...s, submission: detail({ status: "encrypted" }) };
  assert.equal(generateStepErrors("encrypt", encrypted), true);
  assert.notEqual(generateStepErrors("download", encrypted), true);
  assert.equal(generateStepErrors("download", { ...encrypted, downloaded: true }), true);
});
