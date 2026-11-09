import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateJournalDraft,
  buildJournalPayload,
  previewLines,
  previewIsBalanced,
  emptyLine,
} from "./journal";
import type {
  Account,
  JournalEntryDraft,
  JournalLineDraft,
  JournalPreview,
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

/** A server preview, as `POST /accounting/journals/preview` answers. Centavos. */
function preview(over: Partial<JournalPreview> = {}): JournalPreview {
  return {
    total_debit: 350000,
    total_credit: 350000,
    difference: 0,
    out_by: 0,
    heavier_side: null,
    is_balanced: true,
    line_count: 2,
    ...over,
  };
}

const BALANCED = preview();

/**
 * Validation with the server's preview. Most cases below are about structure,
 * so they take a balanced preview; the balance cases pass their own.
 */
function validate(
  d: JournalEntryDraft,
  chart: Account[] = CHART,
  p: JournalPreview | null = BALANCED,
) {
  return validateJournalDraft(d, chart, p);
}

// ── The lines sent to the preview ──

test("previewLines skips blank rows and sends whole centavos", () => {
  const lines = previewLines(
    draft([
      line({ account_id: 2, debit: "1,500.50" }),
      line({ account_id: 1, credit: "1500.50" }),
      line(),
    ]),
  );
  assert.deepEqual(lines, [
    { account_id: 2, debit: 150050, credit: 0 },
    { account_id: 1, debit: 0, credit: 150050 },
  ]);
});

test("previewLines sends an amount that doesn't parse as nothing", () => {
  // Mid-keystroke text ("abc", "-5", "1.2.3") is sent as 0 so the totals keep
  // answering; validation names the bad line on save.
  const lines = previewLines(
    draft([
      line({ account_id: 2, debit: "abc" }),
      line({ account_id: 1, credit: "-5" }),
      line({ account_id: 1, credit: "1.2.3" }),
    ]),
  );
  assert.deepEqual(
    lines.map((l) => [l.debit, l.credit]),
    [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  );
});

test("previewLines keeps both sides of a line, and a row with no account", () => {
  // The server sums what it is sent; the one-side rule is validation's job.
  const lines = previewLines(
    draft([line({ debit: "10", credit: "20" }), line({ description: "Note only" })]),
  );
  assert.deepEqual(lines, [
    { account_id: null, debit: 1000, credit: 2000 },
    { account_id: null, debit: 0, credit: 0 },
  ]);
});

test("previewLines parses amounts exactly as the payload does", () => {
  const d = draft([
    line({ account_id: 2, debit: " ₱ 1 234 567.89 " }),
    line({ account_id: 1, credit: "1.555" }),
  ]);
  const sent = buildJournalPayload(d).lines.map((l) => [l.debit, l.credit]);
  assert.deepEqual(
    previewLines(d).map((l) => [l.debit, l.credit]),
    sent,
  );
});

// ── Balanced, by the server's preview ──

test("balanced needs two lines, a non-zero total and the server's is_balanced", () => {
  assert.equal(previewIsBalanced(preview()), true);
  // The server calls an empty or all-zero body balanced (0 = 0); an entry isn't.
  assert.equal(previewIsBalanced(preview({ total_debit: 0, total_credit: 0 })), false);
  assert.equal(
    previewIsBalanced(preview({ total_debit: 0, total_credit: 0, line_count: 0 })),
    false,
  );
  assert.equal(previewIsBalanced(preview({ line_count: 1 })), false);
  assert.equal(previewIsBalanced(preview({ is_balanced: false })), false);
  assert.equal(previewIsBalanced(null), false);
});

test("a one-line or zero preview never lets a draft save", () => {
  const twoLines = draft([
    line({ account_id: 2, debit: "3500" }),
    line({ account_id: 1, credit: "3500" }),
  ]);
  assert.equal(validate(twoLines, CHART, preview({ line_count: 1 })).ok, false);
});

// ── The central rule ──

test("a balanced two-line entry is valid", () => {
  const result = validate(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("an unbalanced entry cannot be posted, by the server's preview", () => {
  const result = validate(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3000" }),
    ]),
    CHART,
    preview({
      total_credit: 300000,
      difference: 50000,
      out_by: 50000,
      heavier_side: "debit",
      is_balanced: false,
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "balance"));
  assert.match(
    result.errors.find((e) => e.field === "balance")!.message,
    /₱500\.00/
  );
});

test("a line cannot carry a debit and a credit at once", () => {
  const result = validate(
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
  const result = validate(
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
  const result = validate(
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
  const result = validate(
    draft([line({ debit: "3500" }), line({ account_id: 1, credit: "3500" })]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "account"));
});

test("an entry needs at least two lines", () => {
  const result = validate(
    draft([line({ account_id: 2, debit: "3500" })]),
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "lines"));
});

test("an entry of zero on both sides is refused despite balancing", () => {
  // 0 === 0 is balanced and records nothing. Posting it would put an empty
  // journal number into the books for no reason.
  const result = validate(
    draft([
      line({ account_id: 2, debit: "0" }),
      line({ account_id: 1, credit: "0" }),
    ]),
    CHART,
    preview({ total_debit: 0, total_credit: 0 }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "balance"));
});

test("a group header cannot be posted to", () => {
  const result = validate(
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
  const result = validate(
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
  const result = validate(
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
  const result = validate(
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
  const result = validate(
    { ...draft([line({ account_id: 2, debit: "1" }), line({ account_id: 1, credit: "1" })]), date: "" },
    CHART
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "date"));
});

test("a missing description is rejected", () => {
  const result = validate(
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
  const result = validate(
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

test("a fresh line is blank on both sides", () => {
  assert.deepEqual(emptyLine(), {
    account_id: null,
    description: "",
    debit: "",
    credit: "",
  });
});

test("the balance rule reads the preview, never the typed amounts", () => {
  // The typed amounts balance, but the server says they don't: the server wins.
  const result = validate(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART,
    preview({ is_balanced: false, out_by: 100, heavier_side: "credit" }),
  );
  assert.equal(result.ok, false);
  assert.match(
    result.errors.find((e) => e.field === "balance")!.message,
    /₱1\.00/,
  );
});

test("without a preview the balance is not yet known, so the draft can't be saved", () => {
  const result = validate(
    draft([
      line({ account_id: 2, debit: "3500" }),
      line({ account_id: 1, credit: "3500" }),
    ]),
    CHART,
    null,
  );
  assert.equal(result.ok, false);
  assert.match(
    result.errors.find((e) => e.field === "balance")!.message,
    /still being checked/,
  );
});

test("a line still being filled in is reported before the balance", () => {
  const result = validate(
    draft([line({ account_id: 2, debit: "3500" }), line({ account_id: 1 })]),
    CHART,
    preview({ is_balanced: false, out_by: 350000, heavier_side: "debit" }),
  );
  assert.equal(result.errors.some((e) => e.field === "balance"), false);
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

test("the payload carries no totals: the server works them out from the lines", () => {
  const payload = buildJournalPayload(TYPED);
  assert.equal("total_debit" in payload, false);
  assert.equal("total_credit" in payload, false);
  assert.equal(payload.source, "manual");
});

test("the payload's lines are what the preview was sent", () => {
  // Same draft, two code paths. If these ever diverge, the totals on screen
  // describe a different entry from the one saved.
  const payload = buildJournalPayload(TYPED);
  assert.deepEqual(
    payload.lines.map(({ account_id, debit, credit }) => ({ account_id, debit, credit })),
    previewLines(TYPED),
  );
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

test("the payload leaves the balance to the server and the form's preview", () => {
  // No browser sum: validateJournalDraft refuses an unbalanced draft from the
  // server's preview, and posting refuses it again on the server.
  const payload = buildJournalPayload(
    draftOf([
      { account_id: 2, description: "", debit: "1500.50", credit: "" },
      { account_id: 33, description: "", debit: "", credit: "1400.50" },
    ]),
  );
  assert.equal(payload.lines[0].debit, 150050);
  assert.equal(payload.lines[1].credit, 140050);
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
  const validation = validate(TYPED, chart, preview({ total_debit: 150050, total_credit: 150050 }));
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
  assert.equal(previewLines(draft)[0].debit, 156);
});
