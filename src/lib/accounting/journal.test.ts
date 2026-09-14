import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summariseDraft,
  validateJournalDraft,
  buildReversal,
  emptyLine,
} from "./journal";
import type {
  Account,
  JournalEntry,
  JournalEntryDraft,
  JournalLineDraft,
} from "@/types/accounting";

function account(over: Partial<Account> = {}): Account {
  return {
    id: 1,
    code: "1010",
    name: "Cash on Hand",
    type: "asset",
    normal_balance: "debit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    ...over,
  };
}

const CASH = account({ id: 1, code: "1010", name: "Cash on Hand" });
const ELECTRICITY = account({
  id: 2,
  code: "5030",
  name: "Electricity",
  type: "expense",
});
const HEADER = account({ id: 3, code: "1000", name: "Assets", is_group: true });
const RETIRED = account({ id: 4, code: "5999", name: "Old", is_active: false });

const CHART = [CASH, ELECTRICITY, HEADER, RETIRED];

function line(over: Partial<JournalLineDraft> = {}): JournalLineDraft {
  return { account_id: null, description: "", debit: "", credit: "", ...over };
}

function draft(lines: JournalLineDraft[]): JournalEntryDraft {
  return {
    date: "2026-09-12",
    reference: "REF-1",
    branch_id: 1,
    description: "Electricity for September",
    lines,
  };
}

// ── Totals ──

test("totals the two sides and reports the difference", () => {
  const summary = summariseDraft(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ])
  );
  assert.equal(summary.total_debit, 350000);
  assert.equal(summary.total_credit, 350000);
  assert.equal(summary.difference, 0);
  assert.equal(summary.is_balanced, true);
});

test("an out-of-balance draft reports the gap", () => {
  const summary = summariseDraft(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3000" }),
    ])
  );
  assert.equal(summary.difference, 50000);
  assert.equal(summary.is_balanced, false);
});

test("unparseable amounts count as nothing rather than crashing the total", () => {
  const summary = summariseDraft(
    draft([line({ account_id: 2, debit: "abc" }), line({ account_id: 1, credit: "3500" })])
  );
  assert.equal(summary.total_debit, 0);
  assert.equal(summary.total_credit, 350000);
});

// ── The central rule ──

test("a balanced two-line entry is valid", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("an unbalanced entry cannot be posted", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3000" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "balance"));
  assert.match(
    result.errors.find((e) => e.field === "balance")!.message,
    /₱500\.00/
  );
});

test("a line cannot carry a debit and a credit at once", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "3500", credit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "amount"));
});

test("a line with no amount on either side is rejected", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
      line({ account_id: 1 }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 2 && e.field === "amount"));
});

test("a completely untouched trailing row is ignored, not flagged", () => {
  // The form always keeps a spare row on screen; leaving it blank is not an
  // error, it is simply not using it.
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
      line(),
    ]),
    CHART
  );
  assert.equal(result.ok, true);
});

test("an amount with no account selected is rejected", () => {
  const result = validateJournalDraft(
    draft([line({ debit: "3500" }), line({ account_id: 1, credit: "3500" })]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "account"));
});

test("an entry needs at least two lines", () => {
  const result = validateJournalDraft(
    draft([line({ account_id: 2, debit: "3500" })]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "lines"));
});

test("an entry of zero on both sides is refused despite balancing", () => {
  // 0 === 0 is balanced and records nothing. Posting it would put an empty
  // journal number into the books for no reason.
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "0" }),
      line({ account_id: 1, credit: "0" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "balance"));
});

test("a group header cannot be posted to", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 3, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "account"));
});

test("a deactivated account cannot be posted to", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 4, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "account"));
});

test("an account that is not in the chart at all is rejected", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 999, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "account"));
});

test("a negative amount is rejected rather than flipped", () => {
  const result = validateJournalDraft(
    draft([
      line({ account_id: 2, debit: "-3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "amount"));
});

test("a missing date is rejected", () => {
  const result = validateJournalDraft(
    { ...draft([line({ account_id: 2, debit: "1" }), line({ account_id: 1, credit: "1" })]), date: "" },
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "date"));
});

test("a missing description is rejected", () => {
  const result = validateJournalDraft(
    {
      ...draft([line({ account_id: 2, debit: "1" }), line({ account_id: 1, credit: "1" })]),
      description: "   ",
    },
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "description"));
});

test("a many-legged entry balances across all of them", () => {
  // The loan collection shape: one debit against three credits.
  const result = validateJournalDraft(
    draft([
      line({ account_id: 1, debit: "5000" }),
      line({ account_id: 2, credit: "4000" }),
      line({ account_id: 2, credit: "900" }),
      line({ account_id: 2, credit: "100" }),
    ]),
    CHART
  );
  assert.equal(result.ok, true);
});

// ── Reversal ──

test("a reversal swaps every debit and credit", () => {
  const original: JournalEntry = {
    id: 10,
    journal_no: "JE-000154",
    date: "2026-09-12",
    source: "loan_collection",
    reference: "COL-10254",
    description: "Collection from Juan Dela Cruz",
    branch_id: 1,
    status: "posted",
    total_debit: 500000,
    total_credit: 500000,
    lines: [
      { account_id: 1, debit: 500000, credit: 0 },
      { account_id: 2, debit: 0, credit: 400000 },
      { account_id: 3, debit: 0, credit: 90000 },
      { account_id: 4, debit: 0, credit: 10000 },
    ],
  };

  const reversal = buildReversal(original, "2026-09-15");

  assert.equal(reversal.source, "reversal");
  assert.equal(reversal.reverses_journal_id, 10);
  assert.equal(reversal.date, "2026-09-15");
  assert.match(reversal.description, /JE-000154/);
  assert.deepEqual(reversal.lines, [
    { account_id: 1, debit: 0, credit: 500000 },
    { account_id: 2, debit: 400000, credit: 0 },
    { account_id: 3, debit: 90000, credit: 0 },
    { account_id: 4, debit: 10000, credit: 0 },
  ]);
  assert.equal(reversal.total_debit, reversal.total_credit);
});

test("a reversal of a balanced entry is itself balanced", () => {
  const original: JournalEntry = {
    id: 11,
    journal_no: "JE-000155",
    date: "2026-09-12",
    source: "expense",
    description: "Electricity",
    branch_id: 1,
    status: "posted",
    total_debit: 350000,
    total_credit: 350000,
    lines: [
      { account_id: 2, debit: 350000, credit: 0 },
      { account_id: 1, debit: 0, credit: 350000 },
    ],
  };
  const reversal = buildReversal(original, "2026-09-13");
  assert.equal(reversal.total_debit, 350000);
  assert.equal(reversal.total_credit, 350000);
});

test("a draft that is already reversed cannot be reversed again", () => {
  const entry: JournalEntry = {
    id: 12,
    journal_no: "JE-000156",
    date: "2026-09-12",
    source: "expense",
    description: "Electricity",
    branch_id: 1,
    status: "reversed",
    total_debit: 100,
    total_credit: 100,
    reversed_by_journal_id: 13,
    lines: [
      { account_id: 2, debit: 100, credit: 0 },
      { account_id: 1, debit: 0, credit: 100 },
    ],
  };
  assert.throws(() => buildReversal(entry, "2026-09-13"), /already been reversed/i);
});

test("a draft entry cannot be reversed — only posted ones can", () => {
  const entry: JournalEntry = {
    id: 14,
    journal_no: "",
    date: "2026-09-12",
    source: "manual",
    description: "Draft",
    branch_id: 1,
    status: "draft",
    total_debit: 100,
    total_credit: 100,
    lines: [
      { account_id: 2, debit: 100, credit: 0 },
      { account_id: 1, debit: 0, credit: 100 },
    ],
  };
  assert.throws(() => buildReversal(entry, "2026-09-13"), /posted/i);
});

test("a fresh line is blank on both sides", () => {
  assert.deepEqual(emptyLine(), {
    account_id: null,
    description: "",
    debit: "",
    credit: "",
  });
});
