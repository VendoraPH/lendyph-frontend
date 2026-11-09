import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { subjectLockedReason } from "./subject-picker-reason";

test("a locked Member picker says why", () => {
  assert.equal(subjectLockedReason("borrower", false), "Needs access to member details");
  assert.equal(subjectLockedReason("loan", false), "Needs access to loans");
});

test("an open picker gives no reason", () => {
  assert.equal(subjectLockedReason("borrower", true), null);
  assert.equal(subjectLockedReason("loan", true), null);
});

test("the subject picker shows the reason under a locked picker", () => {
  const picker = readFileSync(join(process.cwd(), "src/components/common/subject-picker.tsx"), "utf8");
  assert.match(picker, /subjectLockedReason\(subject, canList\)/);
});
