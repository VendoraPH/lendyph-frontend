import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_REPORT_HINT,
  cutoffProblem,
  cutoffRange,
  noDateRangeScope,
  presetAccountId,
  presetBranchId,
  presetMemberId,
  presetPeriodRange,
  linkedBranchId,
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

test("?branch= opens a branch only for a whole positive id", () => {
  assert.equal(presetBranchId("3"), 3);
  for (const value of [null, "", "abc", "0", "-2", "1.5", "4e2", " 7", "3 ", "03", "all"]) {
    assert.equal(presetBranchId(value), null, String(value));
  }
});

test("?from= and ?to= open a period only when both are real dates in order", () => {
  assert.deepEqual(presetPeriodRange("2026-11-01", "2026-11-16"), { from: "2026-11-01", to: "2026-11-16" });
  assert.deepEqual(presetPeriodRange("2026-11-16", "2026-11-16"), { from: "2026-11-16", to: "2026-11-16" });
  assert.deepEqual(presetPeriodRange("2028-02-29", "2028-03-01"), { from: "2028-02-29", to: "2028-03-01" });
});

test("a missing, malformed or impossible date opens no period", () => {
  const bad: [string | null, string | null][] = [
    [null, null],
    ["2026-11-01", null],
    [null, "2026-11-16"],
    ["", ""],
    ["2026-11-1", "2026-11-16"],
    ["2026/11/01", "2026-11-16"],
    ["01-11-2026", "2026-11-16"],
    ["2026-11-01T00:00", "2026-11-16"],
    [" 2026-11-01", "2026-11-16"],
    ["2026-02-31", "2026-03-05"],
    ["2026-02-29", "2026-03-05"],
    ["2026-13-01", "2026-12-31"],
    ["2026-00-10", "2026-01-31"],
    ["2026-11-00", "2026-11-16"],
    ["2026-11-01", "2026-11-31"],
    ["0001-01-01", "2026-11-16"],
    ["abcd-ef-gh", "2026-11-16"],
  ];
  for (const [from, to] of bad) {
    assert.equal(presetPeriodRange(from, to), null, `${from} → ${to}`);
  }
});

test("a period that starts after it ends opens no period", () => {
  assert.equal(presetPeriodRange("2026-11-17", "2026-11-16"), null);
  assert.equal(presetPeriodRange("2027-01-01", "2026-12-31"), null);
});

test("a report without date controls ignores the period in its link", () => {
  assert.equal(presetPeriodRange("2026-11-01", "2026-11-16", { noDateRange: true }), null);
  assert.deepEqual(presetPeriodRange("2026-11-01", "2026-11-16", { noDateRange: false }), {
    from: "2026-11-01",
    to: "2026-11-16",
  });
});

test("a linked branch counts only once the picker has loaded and offers it", () => {
  const offered = [{ id: 2 }, { id: 5 }];
  assert.equal(linkedBranchId(5, offered, true), 5);
  assert.equal(linkedBranchId(5, offered, false), null, "the list is still loading");
  assert.equal(linkedBranchId(9, offered, true), null, "a branch the picker doesn't offer");
  assert.equal(linkedBranchId(5, [], true), null, "the list failed or is empty");
  assert.equal(linkedBranchId(null, offered, true), null);
});

test("a cutoff report asks for a cutoff date", () => {
  assert.equal(reportPickPrompt({ cutoffDate: true }), "a cutoff date");
});

test("a cutoff date's period runs from January 1 of its year", () => {
  assert.deepEqual(cutoffRange("2026-06-30"), { from: "2026-01-01", to: "2026-06-30" });
  assert.deepEqual(cutoffRange("2028-02-29"), { from: "2028-01-01", to: "2028-02-29" });
  assert.deepEqual(cutoffRange("2026-01-01"), { from: "2026-01-01", to: "2026-01-01" });
  for (const value of ["", "2026-02-31", "2026-6-30", "20260630"]) {
    assert.deepEqual(cutoffRange(value), { from: "", to: "" }, value);
  }
});

test("a cutoff date is a real day no later than today", () => {
  const today = "2026-11-24";
  assert.equal(cutoffProblem("2026-11-24", today), null);
  assert.equal(cutoffProblem("2026-06-30", today), null);
  assert.equal(cutoffProblem("2026-11-25", today), "The cutoff date can't be after today.");
  // A date input reads "" while a part of the date is still blank.
  for (const value of ["", "2026-02-31", "2026-6-30"]) {
    assert.equal(cutoffProblem(value, today), "Pick a cutoff date.", value);
  }
});
