import { test, describe } from "node:test";
import assert from "node:assert/strict";
// Dates read in Philippine time, as the screens show them on a Manila machine.
process.env.TZ = "Asia/Manila";

import type { ReconciliationActionAnswer, ReconciliationDetail, ReconciliationRow } from "./types";
import {
  BRANCH_ACCESS_EXPLANATION,
  afterAction,
  candidateDateText,
  candidateTitle,
  createdNotice,
  descriptionDefault,
  directionLabel,
  headerFigures,
  ledgerLineText,
  loadFailure,
  matchFailure,
  pairedFiguresCaption,
  matchLabel,
  reconciledLabel,
  requestFailure,
  rowFigures,
  suspenseConfirmation,
  transferDirection,
} from "./reconciliation-view";

function detail(overrides: Partial<ReconciliationDetail> = {}): ReconciliationDetail {
  return {
    id: 7,
    account_id: 2,
    account_code: "1020",
    account_name: "Cash in Bank",
    period: "October 2026",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    book_balance: 2_500_050,
    statement_balance: 2_485_050,
    difference: 15_000,
    is_reconciled: false,
    matched_count: 3,
    possible_count: 1,
    unmatched_count: 2,
    outstanding_count: 0,
    notes: null,
    lines: [],
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown>) {
  return { isAxiosError: true, response: { status, data } };
}

describe("the header shows the server's figures", () => {
  test("statement, books and difference in ₱ with two decimals, and the four counts", () => {
    assert.deepEqual(
      headerFigures(detail()).map((f) => [f.label, f.value]),
      [
        ["Statement balance", "₱24,850.50"],
        ["Book balance", "₱25,000.50"],
        ["Difference", "₱150.00"],
        ["Matched", "3"],
        ["Possible matches", "1"],
        ["Unmatched", "2"],
        ["Outstanding items", "0"],
      ],
    );
  });

  test("a zero reads ₱0.00 and a negative keeps its sign", () => {
    const figures = headerFigures(detail({ difference: 0, statement_balance: -150_000 }));
    assert.equal(figures[0].value, "-₱1,500.00");
    assert.equal(figures[2].value, "₱0.00");
  });

  test("nothing is worked out again: figures that don't add up are still shown as sent", () => {
    const odd = detail({
      book_balance: 100,
      statement_balance: 100,
      difference: 999,
      matched_count: 40,
      unmatched_count: 0,
      lines: [],
    });
    const values = headerFigures(odd).map((f) => f.value);
    assert.equal(values[2], "₱9.99");
    assert.equal(values[3], "40");
    assert.equal(values[5], "0");
  });

  test("reconciled or not comes from is_reconciled, not from the difference", () => {
    assert.equal(reconciledLabel(detail({ is_reconciled: true, difference: 15_000 })), "Reconciled");
    assert.equal(reconciledLabel(detail({ is_reconciled: false, difference: 0 })), "Not reconciled");
  });
});

describe("rows read in words", () => {
  const base: ReconciliationRow = {
    journal_id: 345,
    date: "2026-10-05",
    description: "Bank charge",
    amount: -15_000,
    match: "matched",
    external_reference: null,
    journal_no: "JE-000345",
    source: "both",
    statement_line_id: 41,
    journal_line_id: 880,
  };

  test("status labels", () => {
    assert.equal(matchLabel("matched"), "Matched");
    assert.equal(matchLabel("unmatched"), "Unmatched");
    assert.equal(matchLabel("possible"), "Possible match");
  });

  test("money in and money out", () => {
    assert.equal(directionLabel(200_000), "Money in");
    assert.equal(directionLabel(-15_000), "Money out");
  });

  test("the matched or suggested ledger line", () => {
    assert.equal(ledgerLineText(base), "Matched to JE-000345");
    assert.equal(ledgerLineText({ ...base, match: "possible" }), "Suggested: JE-000345");
    assert.equal(
      ledgerLineText({ ...base, match: "unmatched", source: "statement", journal_no: null, journal_id: null }),
      "Not in the books",
    );
    assert.equal(ledgerLineText({ ...base, match: "unmatched", source: "ledger", statement_line_id: null }), "Not on the statement");
  });

  test("an entry dated outside the period reads as an outstanding item, with its date", () => {
    const books = { ...base, match: "unmatched" as const, source: "ledger" as const, statement_line_id: null };
    assert.equal(
      ledgerLineText({ ...books, date: "2026-09-28", outside_period: true }),
      "Outstanding from Sep 28, 2026",
    );
    assert.equal(ledgerLineText({ ...books, outside_period: false }), "Not on the statement");
    assert.equal(candidateDateText({ ...books, date: "2026-09-28", outside_period: true }), "Outstanding from Sep 28, 2026");
    assert.equal(candidateDateText({ ...books, date: "2026-10-05" }), "Oct 5, 2026");
  });

  test("an outstanding entry whose reversal pair nets to zero says so (netted)", () => {
    const books = { ...base, match: "unmatched" as const, source: "ledger" as const, statement_line_id: null };
    const netted = { ...books, date: "2026-09-28", outside_period: true, netted: true };
    assert.equal(ledgerLineText(netted), "Outstanding, nets to zero");
    assert.equal(candidateDateText(netted), "Outstanding from Sep 28, 2026, nets to zero");
    assert.equal(ledgerLineText({ ...netted, netted: false }), "Outstanding from Sep 28, 2026");
  });

  test("a picker row names what it is: the entry's own description, or the statement line it is suggested for", () => {
    const books = { ...base, match: "unmatched" as const, source: "ledger" as const, statement_line_id: null };
    assert.equal(candidateTitle({ ...books, description: "Deposit of collections" }), "Deposit of collections");
    assert.equal(
      candidateTitle({ ...base, match: "possible", description: "DEP 0412" }),
      `Suggested for the statement line "DEP 0412"`,
    );
  });
});

describe("after an action", () => {
  test("the notice names the record and links to its journal", () => {
    assert.deepEqual(createdNotice({ type: "expense", id: 12, journal_id: 345, journal_no: "JE-000345" }), {
      text: "Recorded as expense JE-000345",
      href: "/accounting/journals/345",
    });
    assert.equal(
      createdNotice({ type: "transfer", id: 346, journal_id: 346, journal_no: "JE-000346" }).text,
      "Recorded as transfer JE-000346",
    );
    assert.equal(
      createdNotice({ type: "journal", id: 347, journal_id: 347, journal_no: "JE-000347" }).text,
      "Recorded as suspense entry JE-000347",
    );
  });

  test("the page re-renders from the response's data, not from what it held before", () => {
    const answer: ReconciliationActionAnswer = {
      data: detail({ matched_count: 4, unmatched_count: 1, difference: 0, is_reconciled: true }),
      created: { type: "journal", id: 347, journal_id: 347, journal_no: "JE-000347" },
    };
    const state = afterAction(answer);
    assert.equal(state.reconciliation, answer.data);
    assert.equal(state.notice?.text, "Recorded as suspense entry JE-000347");
  });
});

describe("outstanding items and manual-match refusals", () => {
  test("the header shows the server's outstanding_count as sent, with a short label", () => {
    const figure = headerFigures(detail({ outstanding_count: 4 })).find((f) => f.key === "outstanding");
    assert.deepEqual(figure, { key: "outstanding", label: "Outstanding items", value: "4", money: false });
  });

  test("an older API without outstanding_count shows a dash, never a count of the rows", () => {
    const lines: ReconciliationRow[] = [
      {
        journal_id: 1,
        date: "2026-09-28",
        description: "Deposit in transit",
        amount: 500_000,
        match: "unmatched",
        external_reference: null,
        journal_no: "JE-1",
        source: "ledger",
        statement_line_id: null,
        journal_line_id: 9,
        outside_period: true,
      },
    ];
    const figure = headerFigures(detail({ lines, outstanding_count: undefined })).find((f) => f.key === "outstanding");
    assert.equal(figure?.value, "—");
  });

  test("a 409 or a 422 on match shows the server's words and reloads the worksheet", () => {
    const conflict = "That ledger entry was just matched to another statement line. Reload and try again.";
    assert.deepEqual(matchFailure(httpError(409, { message: conflict }), { canViewAll: true }), {
      reload: true,
      message: conflict,
    });
    const notLive = "This ledger entry was reversed before the period ended, so it can't be matched.";
    assert.deepEqual(
      matchFailure(
        httpError(422, { message: "The given data was invalid.", errors: { journal_line_id: [notLive] } }),
        { canViewAll: true },
      ),
      { reload: true, message: notLive },
    );
  });

  test("a match refused for its amount or side shows the server's words in place, without a reload", () => {
    const differs = "This statement line is ₱88.00 out; the entry is ₱2,000.00 in.";
    assert.deepEqual(
      matchFailure(
        httpError(422, { message: "The given data was invalid.", errors: { matches: [differs] } }),
        { canViewAll: true },
      ),
      { reload: false, message: differs },
    );
  });

  test("other match refusals keep their own handling", () => {
    const err = httpError(403, { message: "This action is unauthorized." });
    assert.deepEqual(matchFailure(err, { canViewAll: false }), { reload: false, message: BRANCH_ACCESS_EXPLANATION });
    assert.equal(matchFailure(httpError(500, { message: "Server Error" }), { canViewAll: true }).reload, false);
  });
});

describe("refusals", () => {
  test("either 409 shows the server's words and reloads", () => {
    for (const message of [
      "This statement line is already matched",
      "Another change to this reconciliation was saved at the same time. Reload and try again.",
    ]) {
      assert.deepEqual(requestFailure(httpError(409, { message }), { canViewAll: true }), {
        reload: true,
        message,
      });
    }
  });

  test("a 422 shows the server's words, whichever field it names", () => {
    for (const [field, words] of [
      ["line", "This statement line is money in. Only money out can be recorded as an expense; record money in as a transfer or a suspense entry."],
      ["account_mapping", "Map a Suspense account in Accounting Settings first"],
      ["date", "The period October 2026 is closed. Reopen it before posting."],
      ["counter_account_id", "Choose a money account other than the one being reconciled."],
    ]) {
      const failure = requestFailure(
        httpError(422, { message: "The given data was invalid.", errors: { [field]: [words] } }),
        { canViewAll: true },
      );
      assert.deepEqual(failure, { reload: false, message: words });
    }
  });

  test("a 403 for someone without access to all branches is explained", () => {
    const err = httpError(403, { message: "This action is unauthorized." });
    assert.deepEqual(requestFailure(err, { canViewAll: false }), {
      reload: false,
      message: BRANCH_ACCESS_EXPLANATION,
    });
    assert.match(BRANCH_ACCESS_EXPLANATION, /all branches/);
    assert.doesNotMatch(BRANCH_ACCESS_EXPLANATION, /branches:view_all/);
    assert.equal(requestFailure(err, { canViewAll: true }).message, "You don't have permission to do that.");
  });

  test("loading: a 403 is explained, a 404 says it doesn't exist", () => {
    assert.equal(loadFailure(httpError(403, {}), { canViewAll: false }), BRANCH_ACCESS_EXPLANATION);
    assert.match(loadFailure(httpError(404, {}), { canViewAll: true }), /doesn't exist/);
  });
});

describe("what each action says it will do", () => {
  const line: ReconciliationRow = {
    journal_id: null,
    date: "2026-10-05",
    description: "Unknown deposit",
    amount: 200_000,
    match: "unmatched",
    external_reference: null,
    journal_no: null,
    source: "statement",
    statement_line_id: 41,
    journal_line_id: null,
  };
  const outgoing: ReconciliationRow = { ...line, description: "Bank charge", amount: -15_000 };

  test("suspense names 2390 Suspense Account, the sides, and that it must be cleared later", () => {
    const moneyIn = suspenseConfirmation(line, "1020 Cash in Bank");
    assert.match(moneyIn.entry, /^Debit 1020 Cash in Bank, credit 2390 Suspense Account\.$/);
    assert.match(moneyIn.warning, /2390 Suspense Account/);
    assert.match(moneyIn.warning, /cleared later/);
    assert.equal(
      suspenseConfirmation(outgoing, "1020 Cash in Bank").entry,
      "Debit 2390 Suspense Account, credit 1020 Cash in Bank.",
    );
  });

  test("a transfer says which way the money moves", () => {
    assert.equal(
      transferDirection(line, "1020 Cash in Bank"),
      "Money in: it moves from the account you pick into 1020 Cash in Bank.",
    );
    assert.equal(
      transferDirection(outgoing, "1020 Cash in Bank"),
      "Money out: it moves from 1020 Cash in Bank to the account you pick.",
    );
  });

  test("the descriptions the server uses when the field is left empty", () => {
    assert.equal(descriptionDefault("expense", outgoing), "Bank charge");
    assert.equal(descriptionDefault("transfer", line), "Transfer from statement line: Unknown deposit");
  });
});

describe("C5 review fixes", () => {
  const IN_BOOKS =
    "This statement line matches JE-000345 already in the books. Match it instead, or record it anyway.";

  test("a line the books already hold is refused with the two choices, in the server's words", () => {
    assert.deepEqual(
      requestFailure(httpError(422, { message: IN_BOOKS, errors: { line: [IN_BOOKS] } }), { canViewAll: true }),
      { reload: false, message: IN_BOOKS, inBooks: true },
    );
  });

  test("other refusals on the line offer no such choice", () => {
    const words = "This statement line is dated outside the reconciliation's dates.";
    const failure = requestFailure(httpError(422, { errors: { line: [words] } }), { canViewAll: true });
    assert.equal(failure.inBooks, undefined);
  });

  test("an account no longer usable reads in the server's words", () => {
    for (const [field, words] of [
      ["account_id", "1020 Cash in Bank is not a money account, so money cannot move through it. Reactivate it or reconcile another account."],
      ["account_mapping", "2390 Suspense Account is deactivated and no longer accepts entries."],
      ["account_mapping", "2390 Suspense Account is a heading. Map a postable account in Accounting Settings."],
    ]) {
      assert.deepEqual(requestFailure(httpError(422, { errors: { [field]: [words] } }), { canViewAll: true }), {
        reload: false,
        message: words,
      });
    }
  });
});

describe("a paired statement line's date and amount", () => {
  const paired: ReconciliationRow = {
    journal_id: 2,
    date: "2026-08-30",
    description: "Deposit",
    amount: 200_000,
    match: "matched",
    external_reference: null,
    journal_no: "JE-000002",
    source: "both",
    statement_line_id: 41,
    journal_line_id: 9,
  };

  test("are labelled as the books entry's, the only figures the server sends for the pair", () => {
    assert.equal(pairedFiguresCaption(paired), "Books entry JE-000002");
    assert.equal(pairedFiguresCaption({ ...paired, match: "possible" }), "Books entry JE-000002");
    assert.equal(pairedFiguresCaption({ ...paired, journal_no: null }), "Books entry");
  });

  test("show the statement line's own date and amount, with the books entry's figures labelled under them", () => {
    assert.deepEqual(rowFigures({ ...paired, statement_date: "2026-08-28", statement_amount: 8_800 }), {
      date: "Aug 28, 2026",
      amount: "₱88.00",
      dateNote: "Books entry JE-000002: Aug 30, 2026",
      amountNote: "Books entry JE-000002: ₱2,000.00",
    });
  });

  test("fall back to the books entry's figures, labelled, from an API that sends no statement figures", () => {
    assert.deepEqual(rowFigures(paired), {
      date: "Aug 30, 2026",
      amount: "₱2,000.00",
      dateNote: "Books entry JE-000002",
      amountNote: "Books entry JE-000002",
    });
    assert.deepEqual(rowFigures({ ...paired, statement_date: null, statement_amount: null }), rowFigures(paired));
  });

  test("on a row with one side only, are its own, with no note", () => {
    const own = { ...paired, source: "statement" as const, match: "unmatched" as const, journal_id: null, journal_line_id: null };
    assert.deepEqual(rowFigures(own), { date: "Aug 30, 2026", amount: "₱2,000.00", dateNote: null, amountNote: null });
  });

  test("an unpaired statement line's figures are its own, with no label", () => {
    assert.equal(
      pairedFiguresCaption({ ...paired, source: "statement", match: "unmatched", journal_id: null, journal_line_id: null }),
      null,
    );
  });
});
