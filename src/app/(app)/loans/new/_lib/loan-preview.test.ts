/**
 * The loan form's preview: what it asks `POST /loans/preview` and how it shows
 * the answer.
 *
 * The form used to add up the collateral, work out the security status and the
 * shortfall, and build the amortization schedule in the browser. It now only
 * describes its inputs to the server and displays what comes back.
 *
 * WHAT THIS PROVES: the body built from the form's fields (deduction inputs
 * included), when there is nothing to ask, that a stale or failed preview
 * shows no figures, the "Short by" rule, which server figure each stated
 * deduction shows, and the read-only Interest Type. WHAT IT DOES NOT PROVE:
 * the figures themselves; those are the backend's preview tests.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { LoanFormPreview } from "@/types";
import type { SelectedCollateral } from "./edit-collaterals";
import {
  formInterestMethod,
  interestMethodLabel,
  loanPreviewFailureMessage,
  loanPreviewKey,
  loanPreviewRequest,
  loanPreviewView,
  previewDeductionAmount,
  showsShortBy,
  type LoanPreviewInputs,
  type LoanPreviewOutcome,
  type StatedDeduction,
} from "./loan-preview";

function selected(id: number, snapshot: number): SelectedCollateral {
  return {
    collateral: { id } as SelectedCollateral["collateral"],
    snapshot_value: snapshot,
  };
}

const COMPLETE: LoanPreviewInputs = {
  productId: "3",
  principalAmount: "50000",
  interestRate: "2.5",
  termValue: "12",
  paymentFrequency: "monthly",
  releaseDate: new Date(2026, 9, 3),
  scbAmount: "100",
  collaterals: [selected(7, 25000.5)],
  deductions: [
    { name: "Processing Fee", amount: 1.5, type: "percentage" },
    { name: "Notarial", amount: 250.5, type: "fixed" },
  ],
};

const PREVIEW: LoanFormPreview = {
  maturity_date: "2027-10-03",
  deductions: {
    items: [
      { name: "Processing Fee", amount: 750, type: "percentage", original_value: 1.5 },
      { name: "Notarial", amount: 250.5, type: "fixed", original_value: 250.5 },
    ],
    stated_total: 1000.5,
    configured_fees: [],
    configured_total: 0,
    total_deductions: 1000.5,
    net_proceeds: 48999.5,
    error: null,
  },
  collateral: { total_value: 25000.5, security_status: "partially_secured", short_by: 24999.5 },
  amortization: {
    maturity_date: "2027-10-03",
    interest_method: "straight",
    rows: [
      {
        period_number: 1,
        due_date: "2026-11-03",
        principal_due: 4166.67,
        interest_due: 1250,
        total_due: 5416.67,
        share_capital_build_up: 100,
        total_payment: 5516.67,
        remaining_balance: 45833.33,
      },
    ],
    totals: { principal_due: 50000, interest_due: 15000, share_capital_build_up: 1200, total_payment: 66200 },
  },
};

describe("loanPreviewRequest", () => {
  test("states every field the form has, as the submit parses them", () => {
    assert.deepEqual(loanPreviewRequest(COMPLETE), {
      loan_product_id: 3,
      principal_amount: 50000,
      interest_rate: 2.5,
      term: 12,
      frequency: "monthly",
      start_date: "2026-10-03",
      scb_amount: 100,
      collaterals: [{ collateral_id: 7, snapshot_value: 25000.5 }],
      deductions: [
        { name: "Processing Fee", amount: 1.5, type: "percentage" },
        { name: "Notarial", amount: 250.5, type: "fixed" },
      ],
    });
  });

  test("states the deduction inputs, never peso amounts worked out from them", () => {
    const request = loanPreviewRequest({
      ...COMPLETE,
      deductions: [{ name: "Service Fee", amount: 2.375, type: "percentage" }],
    });
    assert.deepEqual(request?.deductions, [{ name: "Service Fee", amount: 2.375, type: "percentage" }]);
  });

  test("an empty list is sent as none; null leaves the key out for the product's fees", () => {
    assert.deepEqual(loanPreviewRequest({ ...COMPLETE, deductions: [] })?.deductions, []);
    const request = loanPreviewRequest({ ...COMPLETE, deductions: null });
    assert.ok(request);
    assert.equal("deductions" in request, false);
  });

  test("keeps the rate's and the collateral's decimals exactly as entered", () => {
    const request = loanPreviewRequest({
      ...COMPLETE,
      interestRate: "2.375",
      collaterals: [selected(7, 0.01), selected(8, 1234.56)],
    });
    assert.equal(request?.interest_rate, 2.375);
    assert.deepEqual(request?.collaterals, [
      { collateral_id: 7, snapshot_value: 0.01 },
      { collateral_id: 8, snapshot_value: 1234.56 },
    ]);
  });

  test("leaves out fields with no usable value and lets the server work out what it can", () => {
    assert.deepEqual(
      loanPreviewRequest({
        ...COMPLETE,
        productId: null,
        principalAmount: "",
        interestRate: "0",
        termValue: "abc",
        paymentFrequency: null,
        releaseDate: undefined,
        scbAmount: "",
        deductions: null,
      }),
      { collaterals: [{ collateral_id: 7, snapshot_value: 25000.5 }] },
    );
  });

  test("asks for the schedule with no collateral once its inputs are all known", () => {
    assert.deepEqual(loanPreviewRequest({ ...COMPLETE, scbAmount: "", collaterals: [], deductions: null }), {
      loan_product_id: 3,
      principal_amount: 50000,
      interest_rate: 2.5,
      term: 12,
      frequency: "monthly",
      start_date: "2026-10-03",
      collaterals: [],
    });
  });

  test("asks nothing with no product and no collateral", () => {
    assert.equal(loanPreviewRequest({ ...COMPLETE, productId: null, collaterals: [] }), null);
  });

  test("with a product, still asks while other inputs are missing", () => {
    // The maturity date needs no principal or rate, and the deductions no term,
    // so a half-filled form still gets whatever the server can work out.
    for (const missing of [
      { principalAmount: "0" },
      { interestRate: "" },
      { termValue: "0" },
      { paymentFrequency: null },
      { releaseDate: undefined },
    ] satisfies Partial<LoanPreviewInputs>[]) {
      const request = loanPreviewRequest({ ...COMPLETE, ...missing, collaterals: [] });
      assert.ok(request, JSON.stringify(missing));
      assert.equal(request.loan_product_id, 3);
    }
  });

  test("still asks for the collateral figures while the schedule's inputs are incomplete", () => {
    const request = loanPreviewRequest({ ...COMPLETE, principalAmount: "", termValue: "" });
    assert.ok(request);
    assert.equal(request.principal_amount, undefined);
    assert.deepEqual(request.collaterals, [{ collateral_id: 7, snapshot_value: 25000.5 }]);
  });
});

describe("loanPreviewView", () => {
  const key = loanPreviewKey(loanPreviewRequest(COMPLETE));
  const ready: LoanPreviewOutcome = { key: key!, attempt: 0, view: { status: "ready", preview: PREVIEW } };

  test("idle when there is nothing to preview", () => {
    assert.deepEqual(loanPreviewView(null, 0, ready), { status: "idle" });
  });

  test("loading until the answer for these exact inputs arrives", () => {
    assert.deepEqual(loanPreviewView(key, 0, null), { status: "loading" });
  });

  test("the server's preview once it answers for these inputs", () => {
    assert.deepEqual(loanPreviewView(key, 0, ready), { status: "ready", preview: PREVIEW });
  });

  test("an answer for other inputs is stale: loading, never its figures", () => {
    const otherKey = loanPreviewKey(loanPreviewRequest({ ...COMPLETE, principalAmount: "60000" }));
    assert.notEqual(otherKey, key);
    assert.deepEqual(loanPreviewView(otherKey, 0, ready), { status: "loading" });
  });

  test("a retry waits for its own answer", () => {
    assert.deepEqual(loanPreviewView(key, 1, ready), { status: "loading" });
  });

  test("a failed preview stays failed, with no figures to fall back on", () => {
    const failed: LoanPreviewOutcome = { key: key!, attempt: 0, view: { status: "error", message: "Please try again." } };
    assert.deepEqual(loanPreviewView(key, 0, failed), { status: "error", message: "Please try again." });
  });

  test("equal bodies give equal keys", () => {
    assert.equal(loanPreviewKey(loanPreviewRequest(COMPLETE)), key);
  });
});

describe("loanPreviewFailureMessage", () => {
  test("a 403 says the role can't preview", () => {
    assert.equal(
      loanPreviewFailureMessage({ isAxiosError: true, response: { status: 403, data: {} } }),
      "Your role can't preview loan terms.",
    );
  });

  test("anything else falls back to a retry hint", () => {
    assert.equal(typeof loanPreviewFailureMessage(new Error("boom")), "string");
    assert.notEqual(loanPreviewFailureMessage(new Error("boom")), "boom");
  });
});

describe("showsShortBy", () => {
  test("shown when the server says partially secured or unsecured and a principal is entered", () => {
    assert.equal(showsShortBy(PREVIEW.collateral, 50000), true);
    assert.equal(showsShortBy({ total_value: 0, security_status: "unsecured", short_by: 50000 }, 50000), true);
  });

  test("hidden when the server says secured", () => {
    assert.equal(showsShortBy({ total_value: 60000, security_status: "secured", short_by: 0 }, 50000), false);
  });

  test("hidden with no principal entered", () => {
    assert.equal(showsShortBy({ total_value: 100, security_status: "unsecured", short_by: 0 }, 0), false);
  });
});

describe("interestMethodLabel", () => {
  test("names every method a product can carry", () => {
    assert.equal(interestMethodLabel("straight"), "Straight (Fixed)");
    assert.equal(interestMethodLabel("fixed"), "Straight (Fixed)");
    assert.equal(interestMethodLabel("diminishing"), "Diminishing");
    assert.equal(interestMethodLabel("upon_maturity"), "Upon Maturity");
  });

  test("an unknown method is shown as sent", () => {
    assert.equal(interestMethodLabel("add_on"), "add_on");
  });
});

describe("formInterestMethod", () => {
  const STRAIGHT = { interest_method: "straight" as const };
  const DIMINISHING = { interest_method: "diminishing" as const };
  const MATURITY = { interest_method: "upon_maturity" as const };

  test("a new application shows the selected product's method", () => {
    assert.equal(formInterestMethod({ product: DIMINISHING, storedMethod: null }), "diminishing");
    assert.equal(formInterestMethod({ product: MATURITY, storedMethod: null }), "upon_maturity");
  });

  test("nothing to show before a product is chosen", () => {
    assert.equal(formInterestMethod({ product: null, storedMethod: null }), null);
  });

  test("an edit shows the loan's stored method, whatever the product now says", () => {
    // The product's method may have been changed since; the loan keeps its own.
    assert.equal(formInterestMethod({ product: DIMINISHING, storedMethod: "straight" }), "straight");
  });

  test("an edit keeps the stored method when another product is picked", () => {
    // PUT /loans/{id} keeps the loan's product, so the method cannot change.
    assert.equal(formInterestMethod({ product: MATURITY, storedMethod: "straight" }), "straight");
  });

  test("an edit shows the stored method while the products are still loading", () => {
    assert.equal(formInterestMethod({ product: null, storedMethod: "diminishing" }), "diminishing");
  });

  test("the legacy stored spelling \"fixed\" is shown as straight", () => {
    assert.equal(formInterestMethod({ product: STRAIGHT, storedMethod: "fixed" }), "straight");
  });
});

describe("previewDeductionAmount", () => {
  const PROCESSING: StatedDeduction = { name: "Processing Fee", amount: 1.5, type: "percentage" };
  const NOTARIAL: StatedDeduction = { name: "Notarial Fee", amount: 0.5, type: "percentage" };
  const ITEMS = [
    { name: "Processing Fee", amount: 750, type: "percentage" as const, original_value: 1.5 },
    { name: "Notarial Fee", amount: 250.25, type: "percentage" as const, original_value: 0.5 },
  ];

  test("each stated deduction shows the server's peso amount for it", () => {
    const inputs = [PROCESSING, NOTARIAL];
    assert.equal(previewDeductionAmount(ITEMS, inputs, PROCESSING), 750);
    assert.equal(previewDeductionAmount(ITEMS, inputs, NOTARIAL), 250.25);
  });

  test("no preview, or no item for it, is no figure — never one worked out here", () => {
    const inputs = [PROCESSING, NOTARIAL];
    assert.equal(previewDeductionAmount(null, inputs, PROCESSING), null);
    assert.equal(previewDeductionAmount(undefined, inputs, PROCESSING), null);
    assert.equal(previewDeductionAmount([ITEMS[0]], inputs, NOTARIAL), null);
  });

  test("a field with no input (a waived fee) has no figure", () => {
    assert.equal(previewDeductionAmount(ITEMS, [NOTARIAL], undefined), null);
  });

  test("a percentage and a fixed item of one name are not confused", () => {
    const fixed: StatedDeduction = { name: "Processing Fee", amount: 100, type: "fixed" };
    const items = [
      { name: "Processing Fee", amount: 100, type: "fixed" as const, original_value: 100 },
      { name: "Processing Fee", amount: 750, type: "percentage" as const, original_value: 1.5 },
    ];
    assert.equal(previewDeductionAmount(items, [PROCESSING, fixed], PROCESSING), 750);
    assert.equal(previewDeductionAmount(items, [PROCESSING, fixed], fixed), 100);
  });

  test("two items sharing a name each get their own figure, in order", () => {
    const second: StatedDeduction = { name: "Processing Fee", amount: 0.25, type: "percentage" };
    const items = [
      ITEMS[0],
      { name: "Processing Fee", amount: 125, type: "percentage" as const, original_value: 0.25 },
    ];
    assert.equal(previewDeductionAmount(items, [PROCESSING, second], PROCESSING), 750);
    assert.equal(previewDeductionAmount(items, [PROCESSING, second], second), 125);
  });

  test("an input that is not in the stated list has no figure", () => {
    assert.equal(previewDeductionAmount(ITEMS, [NOTARIAL], { ...PROCESSING }), null);
  });
});
