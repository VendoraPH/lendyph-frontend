import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summariseDraft,
  validateJournalDraft,
  buildJournalPayload,
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

test("a reversal carries no source document of its own", () => {
  // The original's postable belongs to the original. buildReversal builds its
  // payload field by field rather than spreading the entry, so a new field on
  // JournalEntry cannot leak into it — and the server refuses a reversal a
  // postable anyway, because the loan was not released a second time.
  const original: JournalEntry = {
    id: 20,
    journal_no: "JE-000160",
    date: "2026-09-12",
    source: "loan_release",
    reference: "LN-000154",
    description: "Release to Juan Dela Cruz",
    branch_id: 1,
    status: "posted",
    total_debit: 100,
    total_credit: 100,
    postable_type: "loan",
    postable_id: 48,
    postable_label: "LN-000154",
    lines: [
      { account_id: 1, debit: 100, credit: 0 },
      { account_id: 2, debit: 0, credit: 100 },
    ],
  };

  const reversal = buildReversal(original, "2026-09-15");

  assert.equal("postable_type" in reversal, false);
  assert.equal("postable_id" in reversal, false);
  assert.equal("postable_label" in reversal, false);
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

// ── buildJournalPayload ──
//
// The draft-to-wire conversion. `JournalLineDraft.debit` is RAW INPUT TEXT and
// the type says so; the service used to hand the draft to `api.post` untouched,
// so whatever someone typed is what the ledger received. The on-screen balance
// panel read `toCentavos` and was right the entire time, which is exactly why
// nothing caught it — the form said "Balanced" about a request that was not.

function draftOf(lines: JournalLineDraft[]): JournalEntryDraft {
  return {
    date: "2026-09-15",
    reference: "",
    branch_id: null,
    description: "Manual adjustment",
    lines,
  };
}

const TYPED = draftOf([
  { account_id: 2, description: "", debit: "1,500.50", credit: "" },
  { account_id: 33, description: "", debit: "", credit: "1500.50" },
  { account_id: null, description: "", debit: "", credit: "" },
]);

test("raw peso text becomes integer centavos", () => {
  const payload = buildJournalPayload(TYPED);
  assert.equal(payload.lines[0].debit, 150050);
  assert.equal(payload.lines[1].credit, 150050);
});

test("grouped and ungrouped spellings are indistinguishable on the wire", () => {
  // The heart of it: PHP casts "1,500.50" to 1.0 and "1500.50" to 1500.5, so
  // these two lines were NOT equal by the time they were stored.
  const payload = buildJournalPayload(TYPED);
  assert.equal(payload.lines[0].debit, payload.lines[1].credit);
});

test("no amount leaves as a string", () => {
  for (const line of buildJournalPayload(TYPED).lines) {
    assert.equal(typeof line.debit, "number");
    assert.equal(typeof line.credit, "number");
    assert.ok(Number.isInteger(line.debit) && Number.isInteger(line.credit));
  }
});

test("the form's spare blank row is dropped", () => {
  const payload = buildJournalPayload(TYPED);
  assert.equal(payload.lines.length, 2);
  assert.ok(payload.lines.every((l) => l.account_id !== null));
});

test("the unused side of a line is 0, not empty text", () => {
  const payload = buildJournalPayload(TYPED);
  assert.equal(payload.lines[0].credit, 0);
  assert.equal(payload.lines[1].debit, 0);
});

test("totals travel with the lines, as they do on a reversal", () => {
  const payload = buildJournalPayload(TYPED);
  assert.equal(payload.total_debit, 150050);
  assert.equal(payload.total_credit, 150050);
  assert.equal(payload.source, "manual");
});

test("the payload agrees with the panel the user was shown", () => {
  // Same draft, two code paths. If these ever diverge, one of the two screens
  // is lying and there is no way to tell which from the UI.
  const summary = summariseDraft(TYPED);
  const payload = buildJournalPayload(TYPED);
  assert.equal(payload.total_debit, summary.total_debit);
  assert.equal(payload.total_credit, summary.total_credit);
});

test("an empty reference is normalised to null", () => {
  assert.equal(buildJournalPayload(TYPED).reference, null);
  const withRef = buildJournalPayload({ ...TYPED, reference: " JV-2026-0001 " });
  assert.equal(withRef.reference, "JV-2026-0001");
});

test("a line description is trimmed, and absent means null", () => {
  const payload = buildJournalPayload(
    draftOf([
      { account_id: 2, description: "  Rent for September  ", debit: "100", credit: "" },
      { account_id: 33, description: "   ", debit: "", credit: "100" },
    ]),
  );
  assert.equal(payload.lines[0].description, "Rent for September");
  assert.equal(payload.lines[1].description, null);
});

test("a peso sign and thousands separators are resolved before sending", () => {
  const payload = buildJournalPayload(
    draftOf([
      { account_id: 2, description: "", debit: " ₱ 1 234 567.89 ", credit: "" },
      { account_id: 33, description: "", debit: "", credit: "1234567.89" },
    ]),
  );
  assert.equal(payload.lines[0].debit, 123456789);
  assert.equal(payload.lines[0].debit, payload.lines[1].credit);
});

test("an unbalanced draft throws rather than posting", () => {
  assert.throws(
    () =>
      buildJournalPayload(
        draftOf([
          { account_id: 2, description: "", debit: "1500.50", credit: "" },
          { account_id: 33, description: "", debit: "", credit: "1400.50" },
        ]),
      ),
    /differ by/,
  );
});

test("a line with text where an amount belongs throws, quoting the text", () => {
  assert.throws(
    () =>
      buildJournalPayload(
        draftOf([
          { account_id: 2, description: "", debit: "one thousand", credit: "" },
          { account_id: 33, description: "", debit: "", credit: "1000" },
        ]),
      ),
    /one thousand/,
  );
});

test("a negative amount throws instead of being flipped into the other column", () => {
  assert.throws(
    () =>
      buildJournalPayload(
        draftOf([
          { account_id: 2, description: "", debit: "-100", credit: "" },
          { account_id: 33, description: "", debit: "", credit: "100" },
        ]),
      ),
    /positive amount/,
  );
});

test("a line with no account throws", () => {
  assert.throws(
    () =>
      buildJournalPayload(
        draftOf([
          { account_id: null, description: "Something", debit: "100", credit: "" },
          { account_id: 33, description: "", debit: "", credit: "100" },
        ]),
      ),
    /no account/,
  );
});

test("a line carrying both a debit and a credit throws", () => {
  assert.throws(
    () =>
      buildJournalPayload(
        draftOf([
          { account_id: 2, description: "", debit: "100", credit: "100" },
          { account_id: 33, description: "", debit: "", credit: "100" },
        ]),
      ),
    /only be one side/,
  );
});

test("a draft with fewer than two real lines throws", () => {
  assert.throws(
    () =>
      buildJournalPayload(
        draftOf([
          { account_id: 2, description: "", debit: "100", credit: "" },
          emptyLine(),
        ]),
      ),
    /at least two lines/,
  );
});

test("whatever validateJournalDraft accepts, buildJournalPayload can send", () => {
  // The two encode the same rules and must not drift. A draft that passes
  // validation and then throws on the way out is a dead end for the user.
  const chart = [
    account({ id: 2, code: "5030", name: "Electricity", type: "expense" }),
    account({ id: 33, code: "1010", name: "Cash on Hand" }),
  ];
  const validation = validateJournalDraft(TYPED, chart);
  assert.ok(validation.ok, "fixture must be a valid draft");
  assert.doesNotThrow(() => buildJournalPayload(TYPED));
});

test("a rounding-boundary amount lands on the same centavo as the panel", () => {
  const draft = draftOf([
    { account_id: 2, description: "", debit: "1.555", credit: "" },
    { account_id: 33, description: "", debit: "", credit: "1.555" },
  ]);
  const payload = buildJournalPayload(draft);
  assert.equal(payload.lines[0].debit, 156);
  assert.equal(payload.total_debit, summariseDraft(draft).total_debit);
});
