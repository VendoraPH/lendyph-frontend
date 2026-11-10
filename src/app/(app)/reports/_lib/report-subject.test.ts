import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_REPORT_HINT,
  noDateRangeScope,
  presetAccountId,
  presetMemberId,
  reportPickPrompt,
  reportSubjectNoun,
} from "./report-subject";

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

test("?account= opens a savings account only for a whole positive id", () => {
  assert.equal(presetAccountId("12"), 12);
  for (const value of [null, "", "abc", "0", "-1", "1.5"]) {
    assert.equal(presetAccountId(value), null, String(value));
  }
});

test("the savings statement asks for its period and says where to open it from", () => {
  assert.equal(reportPickPrompt({ accountParam: true }), "a date range for the savings account");
  assert.match(ACCOUNT_REPORT_HINT, /savings account's page/);
});

test("a report without dates says what it covers", () => {
  assert.equal(noDateRangeScope("loan"), "Covers the whole loan, as of the day it is generated.");
  assert.equal(noDateRangeScope(undefined), "Covers the whole portfolio, as of the day it is generated.");
});

test("the empty preview asks for what the report actually needs", () => {
  assert.equal(reportPickPrompt({}), "a date range");
  assert.equal(reportPickPrompt({ noDateRange: true, subject: "loan" }), "a loan");
  assert.equal(reportPickPrompt({ noDateRange: true }), "a branch");
});
