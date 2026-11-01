/**
 * Insurance premium left unpaid at release.
 *
 * A release can collect only part of the premium. On every loan that owes
 * the rest, it is owed on the loan (`insurance_owed`), interest-free, and each
 * payment collects it first (`allocated_to_insurance` in the preview,
 * `insurance_applied` on the repayment).
 *
 * WHAT THIS PROVES: each screen's insurance line reads the server's figure
 * and shows only when it is above zero; the labels say what the figure is.
 * WHAT IT DOES NOT PROVE: the figures, which are the server's.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  INSURANCE_OWED_LABEL,
  INSURANCE_PREMIUM_LABEL,
  loanInsuranceOwed,
  previewInsuranceApplied,
  repaymentInsuranceApplied,
} from "./insurance-premium";

describe("loanInsuranceOwed", () => {
  test("the premium still owed, as the server sent it", () => {
    assert.equal(loanInsuranceOwed({ insurance_owed: 200 }), 200);
    assert.equal(loanInsuranceOwed({ insurance_owed: "200.50" }), 200.5);
  });

  test("no line when nothing is owed or the server sent nothing", () => {
    assert.equal(loanInsuranceOwed({ insurance_owed: 0 }), null);
    assert.equal(loanInsuranceOwed({ insurance_owed: "0.00" }), null);
    assert.equal(loanInsuranceOwed({}), null);
    assert.equal(loanInsuranceOwed(null), null);
  });
});

describe("previewInsuranceApplied", () => {
  test("what this payment will collect of the insurance owed", () => {
    assert.equal(previewInsuranceApplied({ allocated_to_insurance: 150, total_insurance: 150 }), 150);
    assert.equal(previewInsuranceApplied({ total_insurance: 75 }), 75);
  });

  test("no line when the payment collects none", () => {
    assert.equal(previewInsuranceApplied({ allocated_to_insurance: 0 }), null);
    assert.equal(previewInsuranceApplied({}), null);
  });
});

describe("repaymentInsuranceApplied", () => {
  test("what a posted payment collected of the insurance owed", () => {
    assert.equal(repaymentInsuranceApplied({ insurance_applied: 200 }), 200);
    assert.equal(repaymentInsuranceApplied({ insurance_applied: 0 }), null);
    assert.equal(repaymentInsuranceApplied({}), null);
  });
});

test("the labels say what the figure is", () => {
  assert.equal(INSURANCE_PREMIUM_LABEL, "Insurance premium");
  assert.equal(INSURANCE_OWED_LABEL, "Insurance premium owed — interest-free, collected first");
});
