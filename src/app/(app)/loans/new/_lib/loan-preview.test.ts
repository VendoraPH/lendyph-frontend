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
  previewFailureText,
  refusedCollateral,
  refusedCollateralMessage,
  showsShortBy,
  type LoanPreviewInputs,
  type LoanPreviewOutcome,
  type StatedDeduction,
} from "./loan-preview";

function selected(id: number, shown: number): SelectedCollateral {
  return {
    collateral: { id } as SelectedCollateral["collateral"],
    shown_value: shown,
  };
}

/** Every key anywhere in a body, however deep. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]);
  }
  return [];
}

const COMPLETE: LoanPreviewInputs = {
  borrowerId: 11,
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
      borrower_id: 11,
      loan_product_id: 3,
      principal_amount: 50000,
      interest_rate: 2.5,
      term: 12,
      frequency: "monthly",
      start_date: "2026-10-03",
      scb_amount: 100,
      collaterals: [{ collateral_id: 7 }],
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

  test("keeps the rate's decimals exactly as entered, and names collaterals by id only", () => {
    // The server values each collateral itself (decision 11a); the figure the
    // form shows for a row is never sent as its value.
    const request = loanPreviewRequest({
      ...COMPLETE,
      interestRate: "2.375",
      collaterals: [selected(7, 0.01), selected(8, 1234.56)],
    });
    assert.equal(request?.interest_rate, 2.375);
    assert.deepEqual(request?.collaterals, [{ collateral_id: 7 }, { collateral_id: 8 }]);
  });

  test("never sends a snapshot_value, whatever the form shows", () => {
    for (const inputs of [
      COMPLETE,
      { ...COMPLETE, collaterals: [selected(7, 0), selected(8, 99_999_999)] },
      { ...COMPLETE, productId: null },
      { ...COMPLETE, sourceLoanId: 40 },
    ]) {
      assert.equal(keysOf(loanPreviewRequest(inputs)).includes("snapshot_value"), false);
    }
  });

  test("sends the member with the collaterals, so the server values them from that member's register", () => {
    const request = loanPreviewRequest({ ...COMPLETE, productId: null, deductions: null });
    assert.equal(request?.borrower_id, 11);
    assert.deepEqual(request?.collaterals, [{ collateral_id: 7 }]);
    const another = loanPreviewRequest({ ...COMPLETE, borrowerId: 12 });
    assert.equal(another?.borrower_id, 12);
  });

  test("leaves the collaterals out until a member is chosen, rather than send ids the server can't value", () => {
    const request = loanPreviewRequest({ ...COMPLETE, borrowerId: null });
    assert.ok(request);
    assert.equal("borrower_id" in request, false);
    assert.equal("collaterals" in request, false);
  });

  test("a restructure names its source loan once a principal is entered, so the server states the shortfall", () => {
    assert.equal(loanPreviewRequest({ ...COMPLETE, sourceLoanId: 40 })?.source_loan_id, 40);
    for (const principalAmount of ["", "0", "abc"]) {
      const blank = loanPreviewRequest({ ...COMPLETE, principalAmount, sourceLoanId: 40 });
      assert.ok(blank);
      assert.equal("source_loan_id" in blank, false, principalAmount);
    }
    const plain = loanPreviewRequest(COMPLETE);
    assert.ok(plain);
    assert.equal("source_loan_id" in plain, false);
    const cleared = loanPreviewRequest({ ...COMPLETE, sourceLoanId: null });
    assert.ok(cleared);
    assert.equal("source_loan_id" in cleared, false);
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
      { borrower_id: 11, collaterals: [{ collateral_id: 7 }] },
    );
  });

  test("asks for the schedule with no collateral once its inputs are all known", () => {
    assert.deepEqual(loanPreviewRequest({ ...COMPLETE, scbAmount: "", collaterals: [], deductions: null }), {
      borrower_id: 11,
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
    assert.deepEqual(request.collaterals, [{ collateral_id: 7 }]);
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

  test("a refused collateral with a readable reason shows just that reason", () => {
    const message = loanPreviewFailureMessage(refusal("collaterals.0.collateral_id", "This collateral belongs to another member."));
    assert.equal(message, "This collateral belongs to another member.");
  });

  test("a refused collateral with no readable reason names the share capital permission", () => {
    const message = loanPreviewFailureMessage(refusal("collaterals", ""));
    assert.match(message, /^A share capital collateral on this form can't be valued for your role/);
    assert.match(message, /Share Capital: View/);
  });

  test("a 422 on another field keeps the server's own message", () => {
    assert.equal(
      loanPreviewFailureMessage({
        isAxiosError: true,
        response: { status: 422, data: { errors: { term: ["The term must be at least 1."] } } },
      }),
      "The term must be at least 1.",
    );
  });

  test("anything else falls back to a retry hint", () => {
    assert.equal(typeof loanPreviewFailureMessage(new Error("boom")), "string");
    assert.notEqual(loanPreviewFailureMessage(new Error("boom")), "boom");
  });
});

function refusal(field: string, reason: string) {
  return {
    isAxiosError: true,
    response: { status: 422, data: { message: "The given data was invalid.", errors: { [field]: [reason] } } },
  };
}

describe("refusedCollateral", () => {
  test("reads which row the server refused, and its reason", () => {
    assert.deepEqual(refusedCollateral(refusal("collaterals.2.collateral_id", "Not valued.")), {
      index: 2,
      reason: "Not valued.",
    });
    assert.deepEqual(refusedCollateral(refusal("collaterals", "Not valued.")), { index: null, reason: "Not valued." });
  });

  test("an unreadable reason (blank, or an identifier) is none", () => {
    assert.deepEqual(refusedCollateral(refusal("collaterals.0.collateral_id", "")), { index: 0, reason: null });
    assert.deepEqual(refusedCollateral(refusal("collaterals.0", "share_capital_hidden")), { index: 0, reason: null });
  });

  test("not a collateral refusal: none", () => {
    assert.equal(refusedCollateral(refusal("term", "The term must be at least 1.")), null);
    assert.equal(refusedCollateral({ isAxiosError: true, response: { status: 403, data: {} } }), null);
    assert.equal(refusedCollateral(new Error("boom")), null);
  });
});

describe("refusedCollateralMessage", () => {
  test("the server's readable reason, alone, whether or not the row can be removed", () => {
    for (const removable of [true, false]) {
      assert.equal(refusedCollateralMessage({ index: 0, reason: "Not valued." }, removable), "Not valued.");
    }
  });

  test("a row the user can remove: suggest removing it", () => {
    const message = refusedCollateralMessage({ index: 0, reason: null }, true);
    assert.match(message, /Remove it to see the loan figures\.$/);
    assert.doesNotMatch(message, /Ask a user/);
  });

  test("a row the user can't remove: ask someone with Share Capital: View, never suggest removing it", () => {
    const message = refusedCollateralMessage({ index: 0, reason: null }, false);
    assert.match(message, /Ask a user with Share Capital: View to complete this loan\.$/);
    assert.doesNotMatch(message, /Remove it/);
  });
});

describe("previewFailureText", () => {
  type Row = { id: number; removable: boolean };
  const rows: Row[] = [
    { id: 1, removable: false },
    { id: 2, removable: true },
  ];
  const isRemovable = (row: Row) => row.removable;
  const failed = (index: number | null) =>
    ({ status: "error", message: "stock", refused: { index, reason: null } }) as const;

  test("names the refused row's own removability", () => {
    assert.match(previewFailureText(failed(0), rows, isRemovable), /Ask a user with Share Capital: View/);
    assert.match(previewFailureText(failed(1), rows, isRemovable), /Remove it/);
  });

  test("with no row index, suggests removing only when every row can be removed", () => {
    assert.match(previewFailureText(failed(null), rows, isRemovable), /Ask a user/);
    assert.match(previewFailureText(failed(null), [rows[1]], isRemovable), /Remove it/);
  });

  test("an index past the rows is not removable", () => {
    assert.match(previewFailureText(failed(5), rows, isRemovable), /Ask a user/);
  });

  test("any other failure keeps its message", () => {
    assert.equal(previewFailureText({ status: "error", message: "Please try again." }, rows, isRemovable), "Please try again.");
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
