import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { OpeningBalance, OpeningBalanceLine } from "@/types";
import {
  CONFLICT_MESSAGE,
  FINALISE_CONFIRM,
  OPENING_EQUITY_LABEL,
  SAVE_TO_SEE_TOTALS,
  accessNotice,
  buildDraft,
  centavosToInput,
  editorLinesFrom,
  equityAccountId,
  figuresView,
  finaliseState,
  postedElsewhereText,
  postedJournalsWarning,
  requestFailure,
  suggestionOffer,
  viewFor,
  withSuggestedLine,
} from "./opening-balances";

const line = (overrides: Partial<OpeningBalanceLine>): OpeningBalanceLine => ({
  id: 1,
  account_id: 10,
  account_code: "1010",
  account_name: "Cash on Hand",
  account_type: "asset",
  debit: 0,
  credit: 0,
  ...overrides,
});

const CASH = line({ id: 1, account_id: 10, account_code: "1010", debit: 150_000 });
const LOANS = line({ id: 2, account_id: 20, account_code: "1100", account_name: "Loans Receivable", debit: 50_000 });
const EQUITY = line({
  id: 3,
  account_id: 30,
  account_code: "3050",
  account_name: "Opening Balance Equity",
  account_type: "equity",
  credit: 120_000,
});

const opening = (overrides: Partial<OpeningBalance> = {}): OpeningBalance => ({
  status: "draft",
  id: 7,
  as_of: "2026-01-01",
  lines: [CASH, LOANS],
  total_debit: 200_000,
  total_credit: 0,
  difference: 200_000,
  is_balanced: false,
  opening_equity_line: null,
  suggested_opening_equity_line: {
    account_id: 30,
    account_code: "3050",
    account_name: "Opening Balance Equity",
    debit: 0,
    credit: 200_000,
  },
  posted_journals_on_or_before_as_of: 0,
  journal: null,
  edit_version: 3,
  finalised_at: null,
  finalised_by: null,
  can_edit: true,
  can_finalise: false,
  blocking_reasons: [
    "The debits and credits differ by ₱2,000.00. Add the difference to 3050 Opening Balance Equity or correct a line.",
  ],
  ...overrides,
});

const NONE = opening({
  status: "none",
  id: null,
  as_of: null,
  lines: [],
  total_debit: 0,
  total_credit: 0,
  difference: 0,
  suggested_opening_equity_line: null,
  edit_version: 0,
  blocking_reasons: ["Add at least two lines."],
});

const httpError = (status: number, data: object = {}) => ({ response: { status, data } });

describe("which view the page shows, by status", () => {
  test("none and draft are edited by someone who can edit", () => {
    assert.equal(viewFor(NONE), "edit");
    assert.equal(viewFor(opening()), "edit");
  });

  test("none and draft are read only without the server's can_edit", () => {
    assert.equal(viewFor(opening({ can_edit: false })), "draft_read_only");
    assert.equal(viewFor({ ...NONE, can_edit: false }), "draft_read_only");
  });

  test("finalised and posted_elsewhere are read only whatever can_edit says", () => {
    assert.equal(viewFor(opening({ status: "finalised", can_edit: true })), "finalised");
    assert.equal(viewFor(opening({ status: "posted_elsewhere", can_edit: true })), "posted_elsewhere");
  });
});

describe("the editor's rows", () => {
  test("a new entry starts with two blank rows", () => {
    assert.deepEqual(editorLinesFrom(NONE), [
      { account_id: null, debit: "", credit: "" },
      { account_id: null, debit: "", credit: "" },
    ]);
  });

  test("a saved draft's rows are the server's lines, amounts exact to the centavo", () => {
    assert.deepEqual(editorLinesFrom(opening()), [
      { account_id: 10, debit: "1500.00", credit: "" },
      { account_id: 20, debit: "500.00", credit: "" },
    ]);
  });

  test("a saved 3050 line, sent in lines[] and as opening_equity_line, is one row", () => {
    const equityAgain = { ...EQUITY, id: 99 };
    const rows = editorLinesFrom(
      opening({ lines: [CASH, LOANS, EQUITY], opening_equity_line: equityAgain }),
    );
    assert.equal(rows.length, 3);
    assert.equal(rows.filter((row) => row.account_id === 30).length, 1);
    assert.deepEqual(rows.at(-1), { account_id: 30, debit: "", credit: "1200.00" });
  });

  test("the editor never adds a balancing line the user didn't add", () => {
    const rows = editorLinesFrom(
      opening({ lines: [CASH, LOANS], opening_equity_line: EQUITY }),
    );
    assert.deepEqual(rows, [
      { account_id: 10, debit: "1500.00", credit: "" },
      { account_id: 20, debit: "500.00", credit: "" },
    ]);
    assert.deepEqual(editorLinesFrom({ ...NONE, opening_equity_line: EQUITY }), [
      { account_id: null, debit: "", credit: "" },
      { account_id: null, debit: "", credit: "" },
    ]);
  });

  test("centavos become input text by string, never through a float", () => {
    assert.equal(centavosToInput(0), "0.00");
    assert.equal(centavosToInput(5), "0.05");
    assert.equal(centavosToInput(150_050), "1500.50");
    assert.equal(centavosToInput(900_719_925_474_099), "9007199254740.99");
  });

  test("the 3050 row is recognised from the server's lines", () => {
    assert.equal(equityAccountId(opening({ opening_equity_line: EQUITY })), 30);
    assert.equal(equityAccountId(opening()), 30);
    assert.equal(equityAccountId(NONE), null);
    assert.equal(OPENING_EQUITY_LABEL, "Opening Balance Equity (3050)");
  });
});

describe("the save body", () => {
  test("sends every line in centavos, with as_of and edit_version, and drops blank rows", () => {
    const built = buildDraft(
      "2026-01-01",
      [
        { account_id: 10, debit: "1,500.50", credit: "" },
        { account_id: null, debit: "", credit: "" },
        { account_id: 30, debit: "", credit: "₱1500.5" },
      ],
      3,
    );
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.deepEqual(built.draft, {
      as_of: "2026-01-01",
      lines: [
        { account_id: 10, debit: 150_050, credit: 0 },
        { account_id: 30, debit: 0, credit: 150_050 },
      ],
      edit_version: 3,
    });
    assert.deepEqual(built.rowOf, [0, 2]);
  });

  test("an empty list may be saved", () => {
    const built = buildDraft("2026-01-01", [{ account_id: null, debit: "", credit: "" }], 0);
    assert.equal(built.ok, true);
    if (built.ok) assert.deepEqual(built.draft.lines, []);
  });

  test("refuses a missing date, a missing account, both sides, no amount, bad text, more than two decimals and a repeated account", () => {
    const built = buildDraft(
      "",
      [
        { account_id: null, debit: "10", credit: "" },
        { account_id: 10, debit: "10", credit: "5" },
        { account_id: 20, debit: "0", credit: "" },
        { account_id: 40, debit: "abc", credit: "" },
        { account_id: 50, debit: "1.005", credit: "" },
        { account_id: 60, debit: "-5", credit: "" },
        { account_id: 70, debit: "1", credit: "" },
        { account_id: 70, debit: "", credit: "1" },
      ],
      1,
    );
    assert.equal(built.ok, false);
    if (built.ok) return;
    assert.deepEqual(
      built.errors.map((e) => e.index),
      [null, 0, 1, 2, 3, 4, 5, 7],
    );
    assert.match(built.errors[0].message, /As of date/);
    assert.match(built.errors[1].message, /Choose an account on line 1/);
    assert.match(built.errors[2].message, /Line 2 has both a debit and a credit/);
    assert.match(built.errors[3].message, /Line 3 needs a debit or a credit above ₱0\.00/);
    assert.match(built.errors[4].message, /Line 4/);
    assert.match(built.errors[5].message, /two decimals/);
    assert.match(built.errors[7].message, /Line 8 repeats the account on line 7/);
  });
});

describe("figures come only from the server's last answer", () => {
  test("shows the server's totals, difference and balance, even when the lines don't add up to them", () => {
    const view = figuresView(
      opening({ total_debit: 999_999, total_credit: 12_345, difference: 987_654, is_balanced: false }),
      false,
    );
    assert.deepEqual(view, {
      totalDebit: "₱9,999.99",
      totalCredit: "₱123.45",
      difference: "₱9,876.54",
      balanced: "No",
      hint: null,
    });
  });

  test("a zero total shows ₱0.00, and a balanced entry reads Yes", () => {
    const view = figuresView(
      opening({ total_debit: 0, total_credit: 0, difference: 0, is_balanced: true }),
      false,
    );
    assert.equal(view.totalDebit, "₱0.00");
    assert.equal(view.difference, "₱0.00");
    assert.equal(view.balanced, "Yes");
  });

  test("while lines are edited and not saved, every figure reads a dash", () => {
    assert.deepEqual(figuresView(opening(), true), {
      totalDebit: "—",
      totalCredit: "—",
      difference: "—",
      balanced: "—",
      hint: SAVE_TO_SEE_TOTALS,
    });
    assert.equal(SAVE_TO_SEE_TOTALS, "Save to see the totals");
  });
});

describe("the 3050 suggestion", () => {
  const suggested = opening().suggested_opening_equity_line!;

  test("is offered only when the server sent one and nothing is unsaved", () => {
    assert.deepEqual(suggestionOffer(opening(), false), {
      line: suggested,
      label: "Put the difference on 3050 Opening Balance Equity",
      amount: "Credit ₱2,000.00",
    });
    assert.equal(suggestionOffer(opening(), true), null);
    assert.equal(suggestionOffer(opening({ suggested_opening_equity_line: null }), false), null);
  });

  test("adds the server's line, or replaces the 3050 line already there, with the server's figures", () => {
    const added = withSuggestedLine(
      [
        { account_id: 10, debit: "1500.00", credit: "" },
        { account_id: 20, debit: "500.00", credit: "" },
      ],
      suggested,
    );
    assert.deepEqual(added.at(-1), { account_id: 30, debit: "", credit: "2000.00" });

    const replaced = withSuggestedLine(
      [
        { account_id: 10, debit: "1500.00", credit: "" },
        { account_id: 30, debit: "", credit: "1200.00" },
      ],
      { ...suggested, credit: 150_000 },
    );
    assert.deepEqual(replaced, [
      { account_id: 10, debit: "1500.00", credit: "" },
      { account_id: 30, debit: "", credit: "1500.00" },
    ]);
  });

  test("a suggestion of ₱0.00 on both sides takes the 3050 line out, as the server says", () => {
    const zero = { ...suggested, debit: 0, credit: 0 };
    assert.deepEqual(suggestionOffer(opening({ suggested_opening_equity_line: zero }), false), {
      line: zero,
      label: "Remove the 3050 Opening Balance Equity line",
      amount: "₱0.00",
    });
    assert.deepEqual(
      withSuggestedLine(
        [
          { account_id: 10, debit: "1500.00", credit: "" },
          { account_id: 30, debit: "", credit: "1500.00" },
        ],
        zero,
      ),
      [{ account_id: 10, debit: "1500.00", credit: "" }],
    );
  });
});

describe("the posted journals warning", () => {
  test("is shown only when the server counts journals on or before as_of", () => {
    assert.equal(postedJournalsWarning(0), null);
    assert.equal(
      postedJournalsWarning(1),
      "1 journal is already posted on or before this date. Opening balances are usually dated before the first entry.",
    );
    assert.equal(
      postedJournalsWarning(4),
      "4 journals are already posted on or before this date. Opening balances are usually dated before the first entry.",
    );
  });
});

describe("finalising", () => {
  test("is enabled only when the server says can_finalise and nothing is unsaved", () => {
    const ready = opening({ can_finalise: true, is_balanced: true, blocking_reasons: [] });
    assert.deepEqual(finaliseState(ready, false), { enabled: true, reasons: [], hint: null });
    assert.deepEqual(finaliseState(ready, true), {
      enabled: false,
      reasons: [],
      hint: "Save your changes before finalising.",
    });
  });

  test("lists each of the server's blocking reasons when it can't", () => {
    const blocked = opening({ can_finalise: false, blocking_reasons: ["January 2026 is closed.", "Add at least two lines."] });
    assert.deepEqual(finaliseState(blocked, false), {
      enabled: false,
      reasons: ["January 2026 is closed.", "Add at least two lines."],
      hint: null,
    });
  });

  test("the server's new reasons show as sent, with Finalise disabled", () => {
    const reasons = [
      "Months after 31 August 2026 are already closed. Reopen them before recording opening balances.",
      "The chart has no 3050 Opening Balance Equity. Add it under 3000 Equity first.",
      "1000 Assets is a heading. Move its balance to the accounts under it.",
      "2300 Other Liabilities is deactivated. Reactivate it or move its balance to another account.",
    ];
    assert.deepEqual(finaliseState(opening({ can_finalise: false, blocking_reasons: reasons }), false), {
      enabled: false,
      reasons,
      hint: null,
    });
    // Any reason disables it, even if can_finalise were to say otherwise.
    assert.equal(finaliseState(opening({ can_finalise: true, blocking_reasons: reasons }), false).enabled, false);
  });

  test("the confirm dialog says it posts once and can't be undone", () => {
    assert.equal(
      FINALISE_CONFIRM,
      "This posts the opening balances once. It can't be undone; correct it later with a journal entry.",
    );
  });
});

describe("refusals", () => {
  const STALE = "Someone else changed the opening balances; reload and try again.";

  test("a 409 reloads and shows the server's message", () => {
    assert.deepEqual(requestFailure(httpError(409, { message: STALE }), [0]), {
      kind: "reload",
      message: STALE,
    });
    assert.deepEqual(requestFailure(httpError(409, {}), [0]), {
      kind: "reload",
      message: `${CONFLICT_MESSAGE}; reload and try again.`,
    });
    assert.equal(CONFLICT_MESSAGE, "Someone else changed the opening balances");
  });

  test("a 422 on edit_version reloads and shows the server's message", () => {
    const missing = "Send the edit_version the opening balances were loaded at; a draft already exists.";
    assert.deepEqual(
      requestFailure(httpError(422, { message: missing, errors: { edit_version: [missing] } }), []),
      { kind: "reload", message: missing },
    );
  });

  test("finalise after the command line posted, with no draft, is a 409 that reloads into the posted view", () => {
    const posted = "An opening balance has already been posted (JE-000123).";
    assert.deepEqual(
      requestFailure(httpError(409, { message: posted }), [], "Could not post the opening balances."),
      { kind: "reload", message: posted },
    );
  });

  test("a closed later month on save is shown as the server sends it, on the date", () => {
    const closed = "Months after 31 August 2026 are already closed. Reopen them before recording opening balances.";
    assert.deepEqual(
      requestFailure(httpError(422, { message: closed, errors: { as_of: [closed] } }), [0]),
      { kind: "error", message: closed, rows: [] },
    );
  });

  test("a finalise 422 reloads, so the server's reasons show and Finalise is disabled", () => {
    const no3050 =
      "This chart has no 3050 Opening Balance Equity, so there is nowhere for the opening equity to go. Nothing was written.";
    assert.deepEqual(
      requestFailure(httpError(422, { message: no3050, errors: { account: [no3050] } }), [], "Could not post the opening balances.", {
        reloadOnInvalid: true,
      }),
      { kind: "reload", message: no3050 },
    );
  });

  test("a 422 on a line keeps the server's words and points at the row it names", () => {
    const failure = requestFailure(
      httpError(422, {
        message: "The given data was invalid.",
        errors: {
          "lines.1.account_id": [
            "Line 2 is on 2300 Other Liabilities, which is deactivated. Reactivate it or use the account that replaced it.",
          ],
        },
      }),
      [0, 2],
    );
    assert.deepEqual(failure, {
      kind: "error",
      message:
        "Line 2 is on 2300 Other Liabilities, which is deactivated. Reactivate it or use the account that replaced it.",
      rows: [2],
    });
  });

  test("another failure reads the fallback, with no row", () => {
    assert.deepEqual(requestFailure(new Error("boom"), []), {
      kind: "error",
      message: "Could not save the opening balances.",
      rows: [],
    });
  });
});

describe("read-only wording", () => {
  test("posted elsewhere names the journal", () => {
    assert.equal(
      postedElsewhereText(opening({ status: "posted_elsewhere", journal: { id: 9, journal_no: "JE-000123" } })),
      "An opening balance was already posted (JE-000123).",
    );
    assert.equal(
      postedElsewhereText(opening({ status: "posted_elsewhere", journal: null })),
      "An opening balance was already posted.",
    );
  });

  test("without branches:view_all the page explains why, in words", () => {
    assert.equal(accessNotice(true), null);
    const notice = accessNotice(false)!;
    assert.match(notice, /whole organisation/);
    assert.match(notice, /every branch/);
    assert.doesNotMatch(notice, /branches:view_all|403/);
  });
});
