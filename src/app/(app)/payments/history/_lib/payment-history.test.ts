/**
 * Payment History: the summary cards and each payment's amount.
 *
 * "Total Collected" and "Total Voided" were browser sums of
 * `amount + penalty_amount` over the payments that loaded, and every row
 * showed the same sum. `amount` is the payment's `amount_paid`, which already
 * includes the penalty it paid, so a payment with a penalty was counted twice
 * over its penalty.
 *
 * WHAT THIS PROVES: search, date range, status tab and page all go to the
 * server, 25 rows at a time; the cards show `meta.totals` as the server sent
 * it, and a dash for a figure that is missing or for a request that isn't the
 * latest; a row shows `amount_paid` with the penalty as a note inside it, not
 * added to it.
 * WHAT IT DOES NOT PROVE: the totals themselves, which the server sums.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PAYMENT_PAGE_SIZE,
  paymentAmountFigures,
  paymentListKey,
  paymentListParams,
  paymentRemarks,
  paymentStatusBreakdown,
  pageToStepBackTo,
  readPaymentPage,
  readPaymentTotals,
  shownPaymentPage,
  totalFigure,
  voidedByName,
} from "./payment-history";

describe("paymentAmountFigures", () => {
  test("shows amount_paid as it is: the penalty is already inside it", () => {
    assert.deepEqual(paymentAmountFigures({ amount: 1500, penalty_amount: 100 }), {
      amount: "₱1,500.00",
      penaltyNote: "incl. ₱100.00 penalty",
      insuranceNote: null,
    });
  });

  test("no note without a penalty", () => {
    assert.deepEqual(paymentAmountFigures({ amount: 1500.55, penalty_amount: 0 }), {
      amount: "₱1,500.55",
      penaltyNote: null,
      insuranceNote: null,
    });
  });

  test("insurance premium the payment collected is a note inside the amount too", () => {
    assert.deepEqual(paymentAmountFigures({ amount: 1500, penalty_amount: 0, insurance_applied: 200 }), {
      amount: "₱1,500.00",
      penaltyNote: null,
      insuranceNote: "incl. ₱200.00 insurance premium",
    });
  });
});

const NO_FILTERS = { search: "", dateFrom: "", dateTo: "", status: "all", page: 1 };

describe("paymentListParams", () => {
  test("asks for 25 rows of one page", () => {
    assert.equal(PAYMENT_PAGE_SIZE, 25);
    assert.deepEqual(paymentListParams(NO_FILTERS), { page: 1, per_page: 25 });
  });

  test("sends the search and date range to the server", () => {
    assert.deepEqual(
      paymentListParams({ ...NO_FILTERS, search: "  Juan   Cruz ", dateFrom: "2026-09-01", dateTo: "2026-09-30", page: 3 }),
      { page: 3, per_page: 25, search: "Juan Cruz", date_from: "2026-09-01", date_to: "2026-09-30" },
    );
  });

  test("the status tabs send the server's own status values", () => {
    assert.equal(paymentListParams({ ...NO_FILTERS, status: "completed" }).status, "posted");
    assert.equal(paymentListParams({ ...NO_FILTERS, status: "voided" }).status, "voided");
    assert.equal("status" in paymentListParams(NO_FILTERS), false);
  });

  test("leaves out a blank search", () => {
    assert.equal("search" in paymentListParams({ ...NO_FILTERS, search: "   " }), false);
  });
});

describe("readPaymentPage", () => {
  const body = {
    data: [{ id: 1 }, { id: 2 }],
    meta: {
      current_page: 2,
      last_page: 4,
      per_page: 25,
      total: 77,
      stats: { posted: 70, voided: 7 },
      totals: { collected: 500, voided: 25, total_insurance_applied: 0 },
    },
  };

  test("takes the rows, the count and the totals from one answer", () => {
    assert.deepEqual(readPaymentPage(body, "k"), {
      key: "k",
      rows: [{ id: 1 }, { id: 2 }],
      page: 2,
      total: 77,
      totals: { collected: 500, voided: 25, insurance: 0 },
      stats: { posted: 70, voided: 7 },
    });
  });

  test("a count the server didn't send stays missing, never the rows' length", () => {
    const page = readPaymentPage({ data: [{ id: 1 }] }, "k");
    assert.equal(page.total, null);
    assert.equal(page.stats, null);
  });
});

describe("shownPaymentPage", () => {
  const answered = { ...readPaymentPage({ data: [{ id: 1 }], meta: { total: 1, totals: { collected: 5 } } }, "old"), failed: false };

  test("an answer for the filters on screen is settled", () => {
    const shown = shownPaymentPage(answered, "old");
    assert.equal(shown.pending, false);
    assert.equal(shown.totals?.collected, 5);
    assert.equal(shown.total, 1);
  });

  test("an answer for other filters keeps its rows up, but its figures read as a dash", () => {
    const shown = shownPaymentPage(answered, "new");
    assert.equal(shown.pending, true);
    assert.deepEqual(shown.rows, [{ id: 1 }]);
    assert.equal(shown.totals, null);
    assert.equal(shown.total, null);
  });

  test("before any answer, nothing is settled", () => {
    const shown = shownPaymentPage(null, "new");
    assert.equal(shown.pending, true);
    assert.deepEqual(shown.rows, []);
  });
});

describe("paymentListKey", () => {
  test("a different filter, page or reload is a different request", () => {
    const key = paymentListKey(paymentListParams(NO_FILTERS), 0);
    assert.notEqual(key, paymentListKey(paymentListParams({ ...NO_FILTERS, page: 2 }), 0));
    assert.notEqual(key, paymentListKey(paymentListParams({ ...NO_FILTERS, status: "voided" }), 0));
    assert.notEqual(key, paymentListKey(paymentListParams(NO_FILTERS), 1));
    assert.equal(key, paymentListKey(paymentListParams(NO_FILTERS), 0));
  });
});

describe("pageToStepBackTo", () => {
  test("an empty page past the end steps back, always lower", () => {
    assert.equal(pageToStepBackTo({ rows: 0, page: 4, lastPage: 3 }), 3);
    assert.equal(pageToStepBackTo({ rows: 0, page: 4, lastPage: 99 }), 3);
    assert.equal(pageToStepBackTo({ rows: 0, page: 4, lastPage: undefined }), 1);
  });

  test("a page with rows, or the first page, stays", () => {
    assert.equal(pageToStepBackTo({ rows: 3, page: 4, lastPage: 4 }), null);
    assert.equal(pageToStepBackTo({ rows: 0, page: 1, lastPage: 1 }), null);
  });
});

describe("paymentStatusBreakdown", () => {
  test("reads the server's counts when no search or date is set", () => {
    assert.equal(
      paymentStatusBreakdown({ posted: 70, voided: 7 }, { search: "", dateFrom: "", dateTo: "" }),
      "70 completed, 7 voided",
    );
  });

  test("says nothing it can't back: the server's counts ignore the search and dates", () => {
    assert.equal(
      paymentStatusBreakdown({ posted: 70, voided: 7 }, { search: "Cruz", dateFrom: "", dateTo: "" }),
      "Matching the search and dates",
    );
    assert.equal(
      paymentStatusBreakdown({ posted: 70, voided: 7 }, { search: "", dateFrom: "2026-09-01", dateTo: "" }),
      "Matching the search and dates",
    );
  });

  test("without counts it says nothing", () => {
    assert.equal(paymentStatusBreakdown(null, { search: "", dateFrom: "", dateTo: "" }), "");
  });
});

describe("the page", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/(app)/payments/history/page.tsx"), "utf8");

  test("never drains the payments", () => {
    assert.doesNotMatch(source, /repaymentService\s*\.listAll/);
    assert.doesNotMatch(source, /IncompleteListNotice/);
  });
});

describe("readPaymentTotals", () => {
  test("reads meta.totals exactly as the server sent them", () => {
    assert.deepEqual(
      readPaymentTotals({
        data: [],
        meta: { stats: { posted: 3 }, totals: { collected: 12345.5, voided: 300, total_insurance_applied: 400.25 } },
      }),
      { collected: 12345.5, voided: 300, insurance: 400.25 }
    );
  });

  test("accepts the decimal strings Laravel can send", () => {
    assert.deepEqual(
      readPaymentTotals({ meta: { totals: { collected: "12345.50", voided: "0.00", total_insurance_applied: "0.00" } } }),
      { collected: 12345.5, voided: 0, insurance: 0 }
    );
  });

  test("a figure the server didn't send is null, never a sum of rows", () => {
    assert.deepEqual(readPaymentTotals({ data: [{ amount_paid: 100, insurance_applied: 50 }], meta: { total: 1 } }), {
      collected: null,
      voided: null,
      insurance: null,
    });
    assert.deepEqual(readPaymentTotals({ meta: { totals: { collected: 5 } } }), {
      collected: 5,
      voided: null,
      insurance: null,
    });
    assert.deepEqual(readPaymentTotals({ meta: { totals: { collected: "abc", voided: null } } }), {
      collected: null,
      voided: null,
      insurance: null,
    });
    assert.deepEqual(readPaymentTotals(null), { collected: null, voided: null, insurance: null });
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

// `voided_by` is the user's id, so the list read "Voided by 1". The name comes
// from `voided_by_user`; without one the row shows a dash, never the id.
test("the voider's name comes from voided_by_user, never the id", () => {
  assert.equal(voidedByName({ voided_by: 1, voided_by_user: { id: 1, name: "Ana Cruz" } }), "Ana Cruz");
  assert.equal(voidedByName({ voided_by: 1 }), "—");
  assert.equal(voidedByName({ voided_by: 1, voided_by_user: null }), "—");
});

test("a legacy method line never reaches a row's remarks", () => {
  assert.equal(paymentRemarks("[method=GCash | collected_by=Ana Cruz]"), undefined);
  assert.equal(paymentRemarks("Paid early\n[method=Cash]"), "Paid early");
  assert.equal(paymentRemarks(undefined), undefined);
});
