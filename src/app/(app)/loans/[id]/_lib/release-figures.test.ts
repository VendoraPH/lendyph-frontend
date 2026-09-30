/**
 * The Release dialog's money, pinned against the server's arithmetic.
 *
 * The dialog used to quote the borrower's net from `loan.net_proceeds`, which
 * leaves out every fee configured in Settings that the release charges. On a
 * loan the release preview put at ₱1,250 of deductions and ₱13,750 net, the
 * dialog said ₱450 and ₱14,550: the cashier was told to count out ₱800 too much.
 *
 * WHAT THIS PROVES: given the server's preview, the figures the dialog shows
 * are what `LoanService::applyInsuranceOnRelease()` will store after the fees,
 * for each way insurance can be typed; and the insurance the dialog sends.
 * WHAT IT DOES NOT PROVE: the preview itself, which is the server's own
 * calculation (see `src/services/loan-release.test.ts` for how it is read).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { InsurancePremiumValue } from "../_components/insurance-premium.types";
import {
  releaseFigures,
  releaseInsurancePayload,
  type ReleaseInsurancePayload,
} from "./release-figures";

/** The preview from the report: four items, ₱1,250 withheld, ₱13,750 net. */
const PREVIEW = { total_deductions: "1250.00", net_proceeds: "13750.00" };
const PRINCIPAL = 15000;

const NO_INSURANCE: ReleaseInsurancePayload = {
  insurance_premium_percentage: 0,
  insurance_premium_amount: 0,
  insurance_payment_type: "full",
  insurance_partial_amount: 0,
  insurance_remaining_balance: 0,
};

function typed(value: Partial<InsurancePremiumValue>): ReleaseInsurancePayload {
  return releaseInsurancePayload(PRINCIPAL, {
    percentage: "",
    paymentType: "full",
    partialAmount: "",
    ...value,
  });
}

describe("releaseFigures", () => {
  test("with no insurance, the borrower receives the preview's net", () => {
    assert.deepEqual(releaseFigures(PREVIEW, NO_INSURANCE), {
      feeDeductions: 1250,
      insuranceCollected: 0,
      totalDeductions: 1250,
      netProceeds: 13750,
      exceedsNetProceeds: false,
    });
  });

  test("a zero percentage is ignored, whatever the other insurance fields say", () => {
    const figures = releaseFigures(PREVIEW, { ...NO_INSURANCE, insurance_premium_amount: 300 });

    assert.equal(figures.netProceeds, 13750);
    assert.equal(figures.totalDeductions, 1250);
  });

  test("a premium paid in full is withheld whole", () => {
    const figures = releaseFigures(PREVIEW, typed({ percentage: "2" }));

    assert.equal(figures.insuranceCollected, 300);
    assert.equal(figures.totalDeductions, 1550);
    assert.equal(figures.netProceeds, 13450);
  });

  test("a partial premium withholds only the part collected now", () => {
    const figures = releaseFigures(PREVIEW, typed({ percentage: "2", paymentType: "partial", partialAmount: "120" }));

    assert.equal(figures.insuranceCollected, 120);
    assert.equal(figures.totalDeductions, 1370);
    assert.equal(figures.netProceeds, 13630);
  });

  test("a partial premium with nothing collected now leaves the preview as it is", () => {
    const figures = releaseFigures(PREVIEW, typed({ percentage: "2", paymentType: "partial" }));

    assert.equal(figures.insuranceCollected, 0);
    assert.equal(figures.totalDeductions, 1250);
    assert.equal(figures.netProceeds, 13750);
  });

  test("centavos come out exact, as the server's round(…, 2) gives them", () => {
    // 13750.10 - 0.20 is 13749.899999999998 in floating point.
    const figures = releaseFigures(
      { total_deductions: "1249.90", net_proceeds: "13750.10" },
      { ...NO_INSURANCE, insurance_premium_percentage: 0.01, insurance_premium_amount: 0.2 },
    );

    assert.equal(figures.netProceeds, 13749.9);
    assert.equal(figures.totalDeductions, 1250.1);
  });

  test("a premium larger than the net is flagged, never clamped to zero", () => {
    const figures = releaseFigures(
      { total_deductions: "14900.00", net_proceeds: "100.00" },
      typed({ percentage: "1" }),
    );

    assert.equal(figures.exceedsNetProceeds, true);
    assert.equal(figures.netProceeds, -50);
  });

  test("a premium equal to the net leaves nothing to pay out, and is allowed", () => {
    const figures = releaseFigures(
      { total_deductions: "14850.00", net_proceeds: "150.00" },
      typed({ percentage: "1" }),
    );

    assert.equal(figures.exceedsNetProceeds, false);
    assert.equal(figures.netProceeds, 0);
  });
});

describe("releaseInsurancePayload", () => {
  test("nothing typed sends a zero percentage, which the server ignores", () => {
    assert.deepEqual(typed({}), NO_INSURANCE);
  });

  test("in full: the premium off the principal, nothing left to collect", () => {
    assert.deepEqual(typed({ percentage: "2" }), {
      insurance_premium_percentage: 2,
      insurance_premium_amount: 300,
      insurance_payment_type: "full",
      insurance_partial_amount: 0,
      insurance_remaining_balance: 0,
    });
  });

  test("partial: the part collected now, capped at the premium, and the rest", () => {
    assert.deepEqual(typed({ percentage: "2", paymentType: "partial", partialAmount: "500" }), {
      insurance_premium_percentage: 2,
      insurance_premium_amount: 300,
      insurance_payment_type: "partial",
      insurance_partial_amount: 300,
      insurance_remaining_balance: 0,
    });
    assert.equal(
      typed({ percentage: "2", paymentType: "partial", partialAmount: "120" }).insurance_remaining_balance,
      180,
    );
  });

  test("a fractional premium is charged at its exact rate, to the centavo", () => {
    assert.equal(typed({ percentage: "1.5" }).insurance_premium_amount, 225);
    assert.equal(typed({ percentage: "2.25" }).insurance_premium_amount, 337.5);
    // round(10001 * 1.5 / 100, 2) is 150.02; Math.round(x * 100) / 100 gave 150.01.
    assert.equal(
      releaseInsurancePayload(10001, { percentage: "1.5", paymentType: "full", partialAmount: "" })
        .insurance_premium_amount,
      150.02,
    );
  });
});
