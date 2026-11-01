/**
 * The Record Payment figures, read from the server.
 *
 * `amount_due_now` on the loan is what a payment must be today to clear the
 * insurance premium owed plus the first open period in full; the payment
 * preview's `balance_after` is the outstanding balance (premium owed
 * included) once the payment posts.
 *
 * WHAT THIS PROVES: each figure shown is the one the server sent, the parts
 * are listed premium first, a missing figure is null (a dash, or a blocked
 * check), and a payment is judged only against the server's amount due.
 * WHAT IT DOES NOT PROVE: the figures, which are the backend's tests.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  amountDueNowParts,
  dueNowHasOpenPeriod,
  dueNowIsRange,
  dueNowOnDate,
  dueNowPeriodLabel,
  dueNowTiles,
  previewBalanceAfter,
  previewBalanceBefore,
  previewIsCurrent,
  previewRequestKey,
  readAmountDueNow,
  shouldPromptExtend,
} from "./payment-figures";

/** Figures that do not add up on purpose: the screen repeats, it never checks. */
const DUE = {
  amount: 12200.37,
  insurance: 400,
  principal: 10000,
  interest: 1800,
  penalty: 0.37,
  share_capital_build_up: 0,
  period_number: 1,
  schedule_id: 501,
};

describe("readAmountDueNow", () => {
  test("reads the server's amount due now and its parts, as sent", () => {
    assert.deepEqual(readAmountDueNow(DUE), {
      amount: 12200.37,
      insurance: 400,
      principal: 10000,
      interest: 1800,
      penalty: 0.37,
      shareCapitalBuildUp: 0,
      periodNumber: 1,
      lastPeriodNumber: null,
      scheduleId: 501,
    });
  });

  test("several periods due: the first period's ids and the last period's number, as sent", () => {
    const due = readAmountDueNow({ ...DUE, amount: 36000, period_number: 2, last_period_number: 4, schedule_id: 502 });
    assert.equal(due?.periodNumber, 2);
    assert.equal(due?.lastPeriodNumber, 4);
    assert.equal(due?.scheduleId, 502);
    assert.equal(dueNowIsRange(due), true);
    assert.equal(dueNowIsRange(readAmountDueNow({ ...DUE, last_period_number: 1 })), false);
    assert.equal(dueNowIsRange(null), false);
  });

  test("decimal strings are read as their figures; no open period is null", () => {
    const due = readAmountDueNow({ ...DUE, amount: "400.00", principal: "0", period_number: null, schedule_id: null });
    assert.equal(due?.amount, 400);
    assert.equal(due?.principal, 0);
    assert.equal(due?.periodNumber, null);
    assert.equal(due?.scheduleId, null);
  });

  test("missing or unreadable is null, never a figure worked out here", () => {
    for (const key of ["amount", "insurance", "principal", "interest", "penalty", "share_capital_build_up"] as const) {
      const rest: Record<string, unknown> = { ...DUE };
      delete rest[key];
      assert.equal(readAmountDueNow(rest), null, key);
    }
    assert.equal(readAmountDueNow({ ...DUE, amount: "abc" }), null);
    for (const junk of [undefined, null, "ok", [], 42]) assert.equal(readAmountDueNow(junk), null);
  });
});

describe("amountDueNowParts", () => {
  test("premium first, then penalty, interest and principal; build-up only when there is one", () => {
    assert.deepEqual(amountDueNowParts(readAmountDueNow({ ...DUE, share_capital_build_up: 100 })), [
      { key: "insurance", label: "Insurance premium", amount: 400 },
      { key: "penalty", label: "Penalty", amount: 0.37 },
      { key: "interest", label: "Interest", amount: 1800 },
      { key: "principal", label: "Principal", amount: 10000 },
      { key: "share_capital_build_up", label: "Share Capital Build-Up", amount: 100 },
    ]);
  });

  test("no premium line when none is owed", () => {
    const parts = amountDueNowParts(readAmountDueNow({ ...DUE, insurance: 0 }));
    assert.deepEqual(parts.map((p) => p.key), ["penalty", "interest", "principal"]);
  });

  test("no parts without the server's figure", () => {
    assert.deepEqual(amountDueNowParts(null), []);
  });
});

describe("the amount due now's date and periods", () => {
  const due = readAmountDueNow(DUE);

  test("it is as of today: another payment date shows no amount due", () => {
    assert.equal(dueNowOnDate(due, "2026-11-02", "2026-11-02"), due);
    assert.equal(dueNowOnDate(due, "2026-11-05", "2026-11-02"), null);
    assert.equal(dueNowOnDate(due, "2026-10-30", "2026-11-02"), null);
    assert.equal(dueNowOnDate(null, "2026-11-02", "2026-11-02"), null);
  });

  test("whether a period is open comes from the server's period", () => {
    assert.equal(dueNowHasOpenPeriod(due), true);
    assert.equal(dueNowHasOpenPeriod(readAmountDueNow({ ...DUE, period_number: null, schedule_id: null })), false);
    assert.equal(dueNowHasOpenPeriod(null), false);
  });

  test("the header names the server's period or range, none when only premium is owed", () => {
    assert.equal(dueNowPeriodLabel(due), "Period 1");
    assert.equal(dueNowPeriodLabel(readAmountDueNow({ ...DUE, period_number: 2, last_period_number: 4 })), "Periods 2–4");
    assert.equal(dueNowPeriodLabel(readAmountDueNow({ ...DUE, period_number: 2, last_period_number: 2 })), "Period 2");
    assert.equal(dueNowPeriodLabel(readAmountDueNow({ ...DUE, period_number: null, schedule_id: null })), null);
    assert.equal(dueNowPeriodLabel(null), null);
  });

  test("without a figure for the date, both screens show the same dashed tiles", () => {
    assert.deepEqual(dueNowTiles(null), [
      { key: "penalty", label: "Penalty", amount: null },
      { key: "interest", label: "Interest", amount: null },
      { key: "principal", label: "Principal", amount: null },
    ]);
    assert.deepEqual(dueNowTiles(due), amountDueNowParts(due));
  });
});

describe("shouldPromptExtend", () => {
  const partial = { payment_badge: { type: "partial", label: "Partial" } };
  const exact = { payment_badge: { type: "exact", label: "Exact" } };

  test("asks to extend when the dated preview for this amount says partial", () => {
    assert.equal(shouldPromptExtend({ hasOpenPeriod: true, preview: partial, previewIsCurrent: true }), "prompt");
  });

  test("posts when the server's badge says the payment is not partial", () => {
    assert.equal(shouldPromptExtend({ hasOpenPeriod: true, preview: exact, previewIsCurrent: true }), "post");
    assert.equal(
      shouldPromptExtend({ hasOpenPeriod: true, preview: { payment_badge: { type: "advance" } }, previewIsCurrent: true }),
      "post",
    );
  });

  test("blocks while the preview is missing, stale, or carries no badge", () => {
    assert.equal(shouldPromptExtend({ hasOpenPeriod: true, preview: null, previewIsCurrent: false }), "unknown");
    assert.equal(shouldPromptExtend({ hasOpenPeriod: true, preview: exact, previewIsCurrent: false }), "unknown");
    assert.equal(shouldPromptExtend({ hasOpenPeriod: true, preview: {}, previewIsCurrent: true }), "unknown");
  });

  test("a preview is current only for the same amount and date", () => {
    assert.equal(previewRequestKey(12200.37, "2026-11-02"), previewRequestKey(12200.37, "2026-11-02"));
    assert.notEqual(previewRequestKey(12200.37, "2026-11-02"), previewRequestKey(12200.37, "2026-11-03"));
    assert.notEqual(previewRequestKey(12200.37, "2026-11-02"), previewRequestKey(12200.36, "2026-11-02"));
  });

  test("a failed preview request says so, rather than still checking", () => {
    assert.equal(
      shouldPromptExtend({ hasOpenPeriod: true, preview: null, previewIsCurrent: false, previewFailed: true }),
      "failed",
    );
    // A later answer for this amount and date wins over an earlier failure.
    assert.equal(
      shouldPromptExtend({ hasOpenPeriod: true, preview: partial, previewIsCurrent: true, previewFailed: false }),
      "prompt",
    );
  });

  test("with no period open there is nothing to extend", () => {
    assert.equal(shouldPromptExtend({ hasOpenPeriod: false, preview: partial, previewIsCurrent: true }), "post");
    assert.equal(shouldPromptExtend({ hasOpenPeriod: false, preview: null, previewIsCurrent: false }), "post");
  });
});

describe("previewIsCurrent", () => {
  test("only a settled answer for exactly this amount and date is current", () => {
    const key = previewRequestKey(12200.37, "2026-11-02");
    assert.equal(previewIsCurrent({ answeredKey: key, loading: false }, 12200.37, "2026-11-02"), true);
    assert.equal(previewIsCurrent({ answeredKey: key, loading: true }, 12200.37, "2026-11-02"), false);
    assert.equal(previewIsCurrent({ answeredKey: key, loading: false }, 12200, "2026-11-02"), false);
    assert.equal(previewIsCurrent({ answeredKey: key, loading: false }, 12200.37, "2026-11-03"), false);
    assert.equal(previewIsCurrent({ answeredKey: null, loading: false }, 12200.37, "2026-11-02"), false);
  });
});

describe("previewBalanceAfter", () => {
  test("the preview's outstanding balance after the payment, as sent", () => {
    assert.equal(previewBalanceAfter({ balance_after: 49600.5 }), 49600.5);
    assert.equal(previewBalanceAfter({ balance_after: "0.00" }), 0);
  });

  test("a dash when the server sent none, never outstanding less principal", () => {
    assert.equal(previewBalanceAfter({ total_principal: 10000 }), null);
    assert.equal(previewBalanceAfter({ balance_after: "abc" }), null);
    assert.equal(previewBalanceAfter(null), null);
  });

  test("the balance before the payment is the preview's too", () => {
    assert.equal(previewBalanceBefore({ balance_before: 60000.5, balance_after: 49600.5 }), 60000.5);
    assert.equal(previewBalanceBefore({}), null);
  });
});
