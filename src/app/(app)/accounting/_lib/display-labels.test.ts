import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountTypeLabel,
  cashKindLabel,
  journalSourceLabel,
  journalStatusLabel,
  periodStatusLabel,
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
