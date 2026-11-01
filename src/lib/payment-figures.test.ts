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
  paymentAgainstDueNow,
  previewBalanceAfter,
  previewBalanceBefore,
  readAmountDueNow,
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
      scheduleId: 501,
    });
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

describe("paymentAgainstDueNow", () => {
  const due = readAmountDueNow(DUE);

  test("covers only at the server's amount due now, to the centavo", () => {
    assert.equal(paymentAgainstDueNow(12200.37, due), "covers");
    assert.equal(paymentAgainstDueNow(12200.374, due), "covers");
    assert.equal(paymentAgainstDueNow(15000, due), "covers");
    assert.equal(paymentAgainstDueNow(12200.36, due), "partial");
    // The period's own total is not enough while premium is owed.
    assert.equal(paymentAgainstDueNow(11800.37, due), "partial");
  });

  test("without the server's amount due now the payment cannot be judged", () => {
    assert.equal(paymentAgainstDueNow(12200.37, null), "unknown");
  });

  test("whether a period is open comes from the server's period", () => {
    assert.equal(dueNowHasOpenPeriod(due), true);
    assert.equal(dueNowHasOpenPeriod(readAmountDueNow({ ...DUE, period_number: null, schedule_id: null })), false);
    assert.equal(dueNowHasOpenPeriod(null), false);
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
