import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Account, Permission } from "@/types";
import type { ReconciliationRow } from "./types";
import {
  ACCEPT_SUGGESTIONS_BODY,
  bookRows,
  EXPENSE_PAYEE_MAX,
  SUSPENSE_DESCRIPTION_MAX,
  counterAccountChoices,
  expenseAccountChoices,
  expenseRequest,
  lineActions,
  matchBody,
  matchCandidates,
  recordAnyway,
  rowMatchAction,
  suspenseRequest,
  transferRequest,
} from "./line-actions";

function row(overrides: Partial<ReconciliationRow> = {}): ReconciliationRow {
  return {
    journal_id: null,
    date: "2026-10-05",
    description: "Bank charge",
    amount: -15_000,
    match: "unmatched",
    external_reference: "BC-1",
    journal_no: null,
    source: "statement",
    statement_line_id: 41,
    journal_line_id: null,
    ...overrides,
  };
}

const ALL: Permission[] = [
  "expenses:create",
  "cash_accounts:transfer",
  "journals:create",
  "journals:post",
];

const holding =
  (held: Permission[]) =>
  (permission: Permission): boolean =>
    held.includes(permission);

describe("which actions an unmatched statement line offers", () => {
  test("money out with every permission: all three, none disabled", () => {
    const actions = lineActions(row(), { can: holding(ALL), chartAvailable: true });
    assert.deepEqual(
      actions.map((a) => [a.kind, a.label, a.visible, a.disabledReason]),
      [
        ["expense", "Record as expense", true, null],
        ["transfer", "Record as transfer", true, null],
        ["suspense", "Move to suspense", true, null],
      ],
    );
  });

  test("money in hides the expense action and says why", () => {
    const [expense, transfer, suspense] = lineActions(row({ amount: 200_000 }), {
      can: holding(ALL),
      chartAvailable: true,
    });
    assert.equal(expense.visible, false);
    assert.match(expense.hiddenReason ?? "", /Only money out can be recorded as an expense/);
    assert.equal(transfer.visible, true);
    assert.equal(suspense.visible, true);
  });

  test("each action is disabled with a reason when its own permission is missing", () => {
    const none = lineActions(row(), { can: holding([]), chartAvailable: true });
    assert.equal(none[0].disabledReason, "Your role can't record expenses.");
    assert.equal(none[1].disabledReason, "Your role can't record transfers between money accounts.");
    assert.equal(none[2].disabledReason, "Your role can't create and post journal entries.");
    for (const action of none) assert.equal(action.visible, true);
  });

  test("suspense needs both journals:create and journals:post (the bookkeeper holds create only)", () => {
    const bookkeeper = lineActions(row(), {
      can: holding(["expenses:create", "journals:create"]),
      chartAvailable: true,
    });
    assert.equal(bookkeeper[0].disabledReason, null);
    assert.equal(bookkeeper[2].disabledReason, "Your role can't create and post journal entries.");

    const postOnly = lineActions(row(), { can: holding(["journals:post"]), chartAvailable: true });
    assert.notEqual(postOnly[2].disabledReason, null);
  });

  test("without a readable chart, expense and transfer can't pick an account; suspense still can", () => {
    const actions = lineActions(row(), { can: holding(ALL), chartAvailable: false });
    assert.match(actions[0].disabledReason ?? "", /chart of accounts/);
    assert.match(actions[1].disabledReason ?? "", /chart of accounts/);
    assert.equal(actions[2].disabledReason, null);
  });

  test("a matched, a suggested or a books-only row offers none of them", () => {
    for (const r of [
      row({ match: "matched", source: "both", journal_line_id: 88 }),
      row({ match: "possible", source: "both", journal_line_id: 88 }),
      row({ source: "ledger", statement_line_id: null, journal_line_id: 88 }),
    ]) {
      assert.deepEqual(lineActions(r, { can: holding(ALL), chartAvailable: true }), []);
    }
  });
});

describe("match and unmatch per line", () => {
  test("a suggestion is confirmed, a match undone, an unmatched statement line matched by hand", () => {
    assert.equal(rowMatchAction(row({ match: "possible", source: "both", journal_line_id: 88 })), "confirm");
    assert.equal(rowMatchAction(row({ match: "matched", source: "both", journal_line_id: 88 })), "unmatch");
    assert.equal(rowMatchAction(row()), "match");
    assert.equal(
      rowMatchAction(row({ source: "ledger", statement_line_id: null, journal_line_id: 88 })),
      null,
    );
  });

  test("the match body pairs one statement line, and null unmatches it", () => {
    assert.deepEqual(matchBody(41, 88), { matches: [{ line_id: 41, journal_line_id: 88 }] });
    assert.deepEqual(matchBody(41, null), { matches: [{ line_id: 41, journal_line_id: null }] });
    assert.deepEqual(ACCEPT_SUGGESTIONS_BODY, { accept_suggestions: true });
  });

  test("the candidates for a hand match are the books-only rows, in the server's order", () => {
    const ledgerA = row({ source: "ledger", statement_line_id: null, journal_line_id: 90, journal_no: "JE-90" });
    const ledgerB = row({ source: "ledger", statement_line_id: null, journal_line_id: 91, journal_no: "JE-91" });
    const lines = [row(), ledgerA, row({ match: "matched", source: "both", journal_line_id: 88 }), ledgerB];
    assert.deepEqual(matchCandidates(lines), [ledgerA, ledgerB]);
  });

  test("the picker offers only rows the match endpoint accepts (matchable), outstanding items included", () => {
    const live = row({ source: "ledger", statement_line_id: null, journal_line_id: 90, matchable: true });
    const outstanding = row({
      source: "ledger",
      statement_line_id: null,
      journal_line_id: 91,
      matchable: true,
      outside_period: true,
      date: "2026-09-28",
    });
    const deadLeg = row({ source: "ledger", statement_line_id: null, journal_line_id: 92, matchable: false });
    const claimed = row({ source: "ledger", statement_line_id: null, journal_line_id: 93, matchable: false });
    assert.deepEqual(matchCandidates([row(), live, deadLeg, outstanding, claimed]), [live, outstanding]);
  });

  test("an older API that sends no matchable keeps offering every books-only row", () => {
    const ledgerA = row({ source: "ledger", statement_line_id: null, journal_line_id: 90 });
    const ledgerB = row({ source: "ledger", statement_line_id: null, journal_line_id: 91 });
    assert.deepEqual(matchCandidates([ledgerA, ledgerB]), [ledgerA, ledgerB]);
  });

  test("the books table still lists every books-only row, matchable or not", () => {
    const deadLeg = row({ source: "ledger", statement_line_id: null, journal_line_id: 92, matchable: false });
    const live = row({ source: "ledger", statement_line_id: null, journal_line_id: 90, matchable: true });
    assert.deepEqual(bookRows([row(), deadLeg, live]), [deadLeg, live]);
  });
});

describe("account pickers", () => {
  const account = (overrides: Partial<Account>): Account => ({
    id: 1,
    code: "1010",
    name: "Cash on Hand",
    type: "asset",
    normal_balance: "debit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    cash_kind: "cash",
    ...overrides,
  });

  const chart = [
    account({ id: 1, code: "1010", cash_kind: "cash" }),
    account({ id: 2, code: "1020", name: "Bank", cash_kind: "bank" }),
    account({ id: 3, code: "1030", name: "GCash", cash_kind: "gcash", is_active: false }),
    account({ id: 4, code: "5010", name: "Bank Charges", type: "expense", cash_kind: null, normal_balance: "debit" }),
    account({ id: 5, code: "5000", name: "Expenses", type: "expense", cash_kind: null, is_group: true }),
  ];

  test("the counter account is an active money account other than the reconciled one", () => {
    assert.deepEqual(counterAccountChoices(chart, 2).map((a) => a.id), [1]);
  });

  test("the expense account is an active, postable expense account", () => {
    assert.deepEqual(expenseAccountChoices(chart).map((a) => a.id), [4]);
  });
});

describe("request bodies", () => {
  test("expense: account and trimmed payee; a blank description is left to the server's default", () => {
    assert.deepEqual(expenseRequest({ expenseAccountId: 4, payee: "  BDO  ", description: "  " }), {
      ok: true,
      body: { expense_account_id: 4, payee: "BDO" },
    });
    assert.deepEqual(
      expenseRequest({ expenseAccountId: 4, payee: "BDO", description: " Monthly fee " }),
      { ok: true, body: { expense_account_id: 4, payee: "BDO", description: "Monthly fee" } },
    );
  });

  test("expense: an account and a payee are required, the payee at most 160 characters", () => {
    assert.equal(EXPENSE_PAYEE_MAX, 160);
    assert.equal(expenseRequest({ expenseAccountId: null, payee: "BDO", description: "" }).ok, false);
    assert.equal(expenseRequest({ expenseAccountId: 4, payee: " ", description: "" }).ok, false);
    assert.equal(expenseRequest({ expenseAccountId: 4, payee: "x".repeat(160), description: "" }).ok, true);
    assert.equal(expenseRequest({ expenseAccountId: 4, payee: "x".repeat(161), description: "" }).ok, false);
    assert.equal(
      expenseRequest({ expenseAccountId: 4, payee: "BDO", description: "x".repeat(501) }).ok,
      false,
    );
  });

  test("transfer: the counter account, never the reconciled one", () => {
    assert.deepEqual(transferRequest({ counterAccountId: 1, description: "" }, 2), {
      ok: true,
      body: { counter_account_id: 1 },
    });
    assert.deepEqual(transferRequest({ counterAccountId: 1, description: " Sweep " }, 2), {
      ok: true,
      body: { counter_account_id: 1, description: "Sweep" },
    });
    assert.equal(transferRequest({ counterAccountId: null, description: "" }, 2).ok, false);
    assert.equal(transferRequest({ counterAccountId: 2, description: "" }, 2).ok, false);
  });

  test("suspense: an empty body, or a description of at most 255 characters", () => {
    assert.equal(SUSPENSE_DESCRIPTION_MAX, 255);
    assert.deepEqual(suspenseRequest({ description: "  " }), { ok: true, body: {} });
    assert.deepEqual(suspenseRequest({ description: "Unknown deposit" }), {
      ok: true,
      body: { description: "Unknown deposit" },
    });
    assert.equal(suspenseRequest({ description: "x".repeat(256) }).ok, false);
  });
});

describe("Record anyway", () => {
  test("resends the same request with record_anyway: true", () => {
    assert.deepEqual(recordAnyway({ kind: "expense", body: { expense_account_id: 4, payee: "BDO" } }), {
      kind: "expense",
      body: { expense_account_id: 4, payee: "BDO", record_anyway: true },
    });
    assert.deepEqual(recordAnyway({ kind: "transfer", body: { counter_account_id: 1, description: "Sweep" } }), {
      kind: "transfer",
      body: { counter_account_id: 1, description: "Sweep", record_anyway: true },
    });
    assert.deepEqual(recordAnyway({ kind: "suspense", body: {} }), {
      kind: "suspense",
      body: { record_anyway: true },
    });
  });

  test("a first request never carries it", () => {
    const first = expenseRequest({ expenseAccountId: 4, payee: "BDO", description: "" });
    assert.ok(first.ok && !("record_anyway" in first.body));
  });
});
