import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOURNAL_PAGE_SIZE,
  journalRegisterParams,
  journalStatusCounts,
  journalTitle,
  registerAmount,
  registerTotalLabel,
} from "./journal-register";

const BASE = {
  from: "2026-11-01",
  to: "2026-11-09",
  branchId: undefined,
  status: "any",
  source: "any",
  search: "",
  page: 1,
};

test("the register asks for one page of 25 with every filter on the server", () => {
  assert.deepEqual(
    journalRegisterParams({
      ...BASE,
      branchId: 3,
      status: "posted",
      source: "loan_release",
      search: "  rent   for  ",
      page: 2,
    }),
    {
      from: "2026-11-01",
      to: "2026-11-09",
      branch_id: 3,
      status: "posted",
      source: "loan_release",
      search: "rent for",
      page: 2,
      per_page: JOURNAL_PAGE_SIZE,
    },
  );
  assert.equal(JOURNAL_PAGE_SIZE, 25);
});

test("'any' status, 'any' source, an empty search and no branch send nothing", () => {
  assert.deepEqual(journalRegisterParams(BASE), {
    from: "2026-11-01",
    to: "2026-11-09",
    page: 1,
    per_page: 25,
  });
});

test("the status counts read the server's stats in words", () => {
  assert.equal(
    journalStatusCounts({ draft: 3, posted: 340, reversed: 1 }),
    "3 drafts, 340 posted, 1 reversed",
  );
  assert.equal(journalStatusCounts({ draft: 1, posted: 0, reversed: 0 }), "1 draft, 0 posted, 0 reversed");
  assert.equal(journalStatusCounts(undefined), "");
});

test("a draft, which has no number yet, reads as a draft", () => {
  assert.equal(journalTitle({ id: 9, journal_no: "JE-000154" }), "JE-000154");
  assert.equal(journalTitle({ id: 9, journal_no: "" }), "Draft #9");
});

test("the totals line says which entries it covers, never 'posted activity'", () => {
  const all = registerTotalLabel(12, "any");
  assert.match(all, /^Register total: 12 entries/);
  assert.match(all, /drafts/);
  assert.match(all, /reversals/);
  assert.doesNotMatch(all, /posted activity/i);

  assert.equal(registerTotalLabel(1, "draft"), "Register total: 1 draft entry");
  assert.equal(registerTotalLabel(3, "posted"), "Register total: 3 posted entries");
  assert.equal(registerTotalLabel(2, "reversed"), "Register total: 2 reversed entries");
});

test("a row's amount is either side when they agree, else both sides", () => {
  assert.equal(registerAmount({ total_debit: 150050, total_credit: 150050 }), "₱1,500.50");
  assert.equal(
    registerAmount({ total_debit: 150050, total_credit: 100000 }),
    "Dr ₱1,500.50 · Cr ₱1,000.00",
  );
  assert.equal(registerAmount({ total_debit: 0, total_credit: 0 }), "₱0.00");
});
