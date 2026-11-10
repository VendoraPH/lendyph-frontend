import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountTypeLabel,
  allowanceBucketLabel,
  cashKindLabel,
  chartTemplateLabel,
  expenseStatusLabel,
  journalSourceLabel,
  journalStatusLabel,
  normalBalanceLabel,
  openingBalanceStatusLabel,
  periodStatusLabel,
  yearCloseStatusLabel,
} from "./display-labels";

test("a journal's status reads in words", () => {
  assert.equal(journalStatusLabel("draft"), "Draft");
  assert.equal(journalStatusLabel("posted"), "Posted");
  assert.equal(journalStatusLabel("reversed"), "Reversed");
});

test("a journal's source reads in words", () => {
  assert.equal(journalSourceLabel("loan_release"), "Loan Release");
  assert.equal(journalSourceLabel("loan_collection"), "Loan Collection");
  assert.equal(journalSourceLabel("gcash"), "GCash");
  assert.equal(journalSourceLabel("cash_in"), "Cash In");
  assert.equal(journalSourceLabel("manual"), "Manual");
  assert.equal(journalSourceLabel("credit_loss"), "Credit Loss");
});

test("the four savings sources read in words", () => {
  assert.equal(journalSourceLabel("savings"), "Savings");
  assert.equal(journalSourceLabel("savings_interest"), "Savings interest");
  assert.equal(journalSourceLabel("time_deposit"), "Time deposit placement");
  assert.equal(journalSourceLabel("time_deposit_settlement"), "Time deposit settlement");
});

test("a source the screen doesn't know yet still reads in words", () => {
  assert.equal(journalSourceLabel("share_capital"), "Share Capital");
  assert.equal(journalSourceLabel("something_new"), "Something New");
});

test("an account's type and kind read in words", () => {
  assert.equal(accountTypeLabel("asset"), "Asset");
  assert.equal(accountTypeLabel("liability"), "Liability");
  assert.equal(cashKindLabel("bank"), "Bank");
  assert.equal(cashKindLabel("gcash"), "GCash");
});

test("a period's status reads in words", () => {
  assert.equal(periodStatusLabel("open"), "Open");
  assert.equal(periodStatusLabel("closed"), "Closed");
});

test("an expense's status reads as the status filter reads it", () => {
  assert.equal(expenseStatusLabel("unpaid"), "Unpaid");
  assert.equal(expenseStatusLabel("partially_paid"), "Partially paid");
  assert.equal(expenseStatusLabel("paid"), "Paid");
  assert.equal(expenseStatusLabel("overdue"), "Overdue");
});

test("an expense status the screen doesn't know yet still reads in words", () => {
  assert.equal(expenseStatusLabel("written_off"), "Written Off");
});

test("the year-end closing source and the two statement-line sources read as staff say them", () => {
  assert.equal(journalSourceLabel("closing"), "Year-end closing");
  assert.equal(journalSourceLabel("bank_transaction"), "Bank statement entry");
  assert.equal(journalSourceLabel("cash_transaction"), "Cash count entry");
  assert.equal(journalSourceLabel("opening_balance"), "Opening Balance");
});

test("a chart template reads in words", () => {
  assert.equal(chartTemplateLabel("lending_company"), "Lending company");
  assert.equal(chartTemplateLabel("cooperative"), "Cooperative");
  assert.equal(chartTemplateLabel("something_new"), "Something New");
});

test("an allowance bucket reads as a range of days", () => {
  assert.equal(allowanceBucketLabel("1_30"), "1–30 days");
  assert.equal(allowanceBucketLabel("31_60"), "31–60 days");
  assert.equal(allowanceBucketLabel("61_90"), "61–90 days");
  assert.equal(allowanceBucketLabel("91_120"), "91–120 days");
  assert.equal(allowanceBucketLabel("over_120"), "Over 120 days");
});

test("a year close's status reads in words", () => {
  assert.equal(yearCloseStatusLabel("closed"), "Closed");
  assert.equal(yearCloseStatusLabel("reopened"), "Reopened");
});

test("the opening balances' status reads in words", () => {
  assert.equal(openingBalanceStatusLabel("none"), "Not started");
  assert.equal(openingBalanceStatusLabel("draft"), "Draft");
  assert.equal(openingBalanceStatusLabel("finalised"), "Posted");
  assert.equal(openingBalanceStatusLabel("posted_elsewhere"), "Posted from the command line");
});

test("an account's normal side reads Debit or Credit, never the stored key", () => {
  assert.equal(normalBalanceLabel("debit"), "Debit");
  assert.equal(normalBalanceLabel("credit"), "Credit");
  assert.equal(normalBalanceLabel("Credit"), "Credit");
});
