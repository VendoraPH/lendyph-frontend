/**
 * Payment History: the summary cards and each payment's amount.
 *
 * "Total Collected" and "Total Voided" were browser sums of
 * `amount + penalty_amount` over the payments that loaded, and every row
 * showed the same sum. `amount` is the payment's `amount_paid`, which already
 * includes the penalty it paid, so a payment with a penalty was counted twice
 * over its penalty.
 *
 * WHAT THIS PROVES: the totals request carries the page's search and date
 * range (never the status tab); the cards show `meta.totals` as the server
 * sent it, and a dash for a figure that is missing or still loading; a row
 * shows `amount_paid` with the penalty as a note inside it, not added to it.
 * WHAT IT DOES NOT PROVE: the totals themselves, which the server sums.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  paymentAmountFigures,
  paymentTotalsParams,
  readPaymentTotals,
  totalFigure,
} from "./payment-history";
import { firstLastNameFrom, inPaymentDateRange, matchesPaymentSearch } from "./payment-history";

describe("paymentAmountFigures", () => {
  test("shows amount_paid as it is: the penalty is already inside it", () => {
    assert.deepEqual(paymentAmountFigures({ amount: 1500, penalty_amount: 100 }), {
      amount: "₱1,500.00",
      penaltyNote: "incl. ₱100.00 penalty",
    });
  });

  test("no note without a penalty", () => {
    assert.deepEqual(paymentAmountFigures({ amount: 1500.55, penalty_amount: 0 }), {
      amount: "₱1,500.55",
      penaltyNote: null,
    });
  });
});

describe("paymentTotalsParams", () => {
  test("sends the search and date range, one row, and never the status", () => {
    assert.deepEqual(
      paymentTotalsParams({ search: "  Cruz ", dateFrom: "2026-09-01", dateTo: "2026-09-30" }),
      { per_page: 1, search: "Cruz", date_from: "2026-09-01", date_to: "2026-09-30" }
    );
  });

  test("leaves out filters that are blank", () => {
    assert.deepEqual(paymentTotalsParams({ search: "   ", dateFrom: "", dateTo: "" }), { per_page: 1 });
  });
});

describe("readPaymentTotals", () => {
  test("reads meta.totals exactly as the server sent them", () => {
    assert.deepEqual(
      readPaymentTotals({ data: [], meta: { stats: { posted: 3 }, totals: { collected: 12345.5, voided: 300 } } }),
      { collected: 12345.5, voided: 300 }
    );
  });

  test("accepts the decimal strings Laravel can send", () => {
    assert.deepEqual(readPaymentTotals({ meta: { totals: { collected: "12345.50", voided: "0.00" } } }), {
      collected: 12345.5,
      voided: 0,
    });
  });

  test("a figure the server didn't send is null, never a sum of rows", () => {
    assert.deepEqual(readPaymentTotals({ data: [{ amount_paid: 100 }], meta: { total: 1 } }), {
      collected: null,
      voided: null,
    });
    assert.deepEqual(readPaymentTotals({ meta: { totals: { collected: 5 } } }), { collected: 5, voided: null });
    assert.deepEqual(readPaymentTotals({ meta: { totals: { collected: "abc", voided: null } } }), {
      collected: null,
      voided: null,
    });
    assert.deepEqual(readPaymentTotals(null), { collected: null, voided: null });
  });
});

describe("totalFigure", () => {
  test("formats a server figure to the centavo", () => {
    assert.equal(totalFigure(12345.5), "₱12,345.50");
    assert.equal(totalFigure(0), "₱0.00");
  });

  test("a dash while loading or when the server sent nothing", () => {
    assert.equal(totalFigure(null), "—");
    assert.equal(totalFigure(undefined), "—");
  });
});

// The table filters on the same fields as the server's totals (receipt number,
// loan account number, "first last" name), so searching "Juan M" can't show a
// member's rows while the cards say ₱0.00.
const row = { receipt_number: "OR-000123", loan_account_number: "LN-000045", first_last_name: "Juan Dela Cruz" };

test("search matches the receipt, the loan account and the first-last name, trimmed and case-insensitive", () => {
  assert.equal(matchesPaymentSearch(row, "  or-000123 "), true);
  assert.equal(matchesPaymentSearch(row, "ln-0000"), true);
  assert.equal(matchesPaymentSearch(row, "juan dela"), true);
  assert.equal(matchesPaymentSearch(row, ""), true);
});

test("search doesn't match a middle name or an application number the server doesn't search", () => {
  assert.equal(matchesPaymentSearch(row, "Juan M"), false);
  assert.equal(matchesPaymentSearch({ ...row, loan_account_number: null }, "LA-000045"), false);
});

test("the date range includes both end days and ignores the time part", () => {
  assert.equal(inPaymentDateRange("2026-11-01", "2026-11-01", "2026-11-01"), true);
  assert.equal(inPaymentDateRange("2026-11-01T23:59:00Z", "", "2026-11-01"), true);
  assert.equal(inPaymentDateRange("2026-10-31", "2026-11-01", ""), false);
});

// GET /repayments sends the name flat (`borrower_first_last`), not a nested
// borrower: reading only the nested names left every row's name empty, so a
// member-name search showed no rows while the cards showed their totals.
test("the first-last name comes from the flat field GET /repayments sends", () => {
  assert.equal(firstLastNameFrom({ borrower_first_last: "Juan Dela Cruz" }), "Juan Dela Cruz");
  assert.equal(firstLastNameFrom({ loan: { borrower: { first_name: "Ana", last_name: "Reyes" } } }), "Ana Reyes");
  assert.equal(firstLastNameFrom({}), null);
});
