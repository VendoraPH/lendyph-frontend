import { test } from "node:test";
import assert from "node:assert/strict";
import { presetMemberId, reportSubjectNoun } from "./report-subject";

test("a report that needs one person asks for a member", () => {
  assert.equal(reportSubjectNoun("borrower"), "member");
});

test("a report that needs one loan asks for a loan", () => {
  assert.equal(reportSubjectNoun("loan"), "loan");
});

test("?member= opens a member only for a whole positive id", () => {
  assert.equal(presetMemberId("42"), 42);
  for (const value of [null, "", "abc", "0", "-1", "1.5", "4e2", " 7"]) {
    assert.equal(presetMemberId(value), null, String(value));
  }
});
