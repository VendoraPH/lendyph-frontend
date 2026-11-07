import { test } from "node:test";
import assert from "node:assert/strict";
import { reportSubjectNoun } from "./report-subject";

test("a report that needs one person asks for a member", () => {
  assert.equal(reportSubjectNoun("borrower"), "member");
});

test("a report that needs one loan asks for a loan", () => {
  assert.equal(reportSubjectNoun("loan"), "loan");
});
