/**
 * The loan form's preview: what it asks `POST /loans/preview` and how it shows
 * the answer.
 *
 * The form used to add up the collateral, work out the security status and the
 * shortfall, and build the amortization schedule in the browser. It now only
 * describes its inputs to the server and displays what comes back.
 *
 * WHAT THIS PROVES: the body built from the form's fields, when there is
 * nothing to ask, that a stale or failed preview shows no figures, and the
 * "Short by" rule. WHAT IT DOES NOT PROVE: the figures themselves; those are
 * the backend's preview tests.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { LoanFormPreview } from "@/types";
import type { SelectedCollateral } from "./edit-collaterals";
import {
  interestMethodLabel,
  loanPreviewFailureMessage,
  loanPreviewKey,
  loanPreviewRequest,
  loanPreviewView,
  showsShortBy,
  type LoanPreviewInputs,
  type LoanPreviewOutcome,
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
};

const PREVIEW: LoanFormPreview = {
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
    });
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
      }),
      { collaterals: [{ collateral_id: 7, snapshot_value: 25000.5 }] },
    );
  });

  test("asks for the schedule with no collateral once its inputs are all known", () => {
    assert.deepEqual(loanPreviewRequest({ ...COMPLETE, scbAmount: "", collaterals: [] }), {
      loan_product_id: 3,
      principal_amount: 50000,
      interest_rate: 2.5,
      term: 12,
      frequency: "monthly",
      start_date: "2026-10-03",
      collaterals: [],
    });
  });

  test("asks nothing with no collateral and a schedule input missing", () => {
    for (const missing of [
      { productId: null },
      { principalAmount: "0" },
      { interestRate: "" },
      { termValue: "0" },
      { paymentFrequency: null },
      { releaseDate: undefined },
    ] satisfies Partial<LoanPreviewInputs>[]) {
      assert.equal(loanPreviewRequest({ ...COMPLETE, ...missing, collaterals: [] }), null);
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
  test("names the server's method as the Interest Type select does", () => {
    assert.equal(interestMethodLabel("straight"), "Straight (Fixed)");
    assert.equal(interestMethodLabel("fixed"), "Straight (Fixed)");
    assert.equal(interestMethodLabel("diminishing"), "Diminishing");
  });

  test("an unknown method is shown as sent", () => {
    assert.equal(interestMethodLabel("add_on"), "add_on");
  });
});
