/**
 * The Release dialog's insurance: what it asks the server and what it sends.
 *
 * The dialog used to work the premium out in the browser (principal ×
 * percentage), subtract a partial payment for the remaining balance, and apply
 * the result to the release preview for the deductions and net after
 * insurance. Every one of those figures is now the server's, from
 * `GET /loans/{id}/release-preview` asked about the insurance typed.
 *
 * WHAT THIS PROVES: the query built from what was typed; that the release
 * sends the previewed premium and remaining balance, never one of its own;
 * the partial field's tidy on blur and its over-the-premium warning; and that
 * a stale or failed insurance preview shows no figures.
 * WHAT IT DOES NOT PROVE: the figures themselves, which are the server's (see
 * `src/services/loan-release.test.ts` for how the preview is read).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { InsurancePremiumValue } from "../_components/insurance-premium.types";
import type { LoanReleasePreview } from "@/types/loan";
import {
  partialAmountOnBlur,
  partialExceedsPremium,
  releaseInsuranceFailureMessage,
  releaseInsuranceKey,
  releaseInsurancePayload,
  releaseInsuranceQuery,
  releaseInsuranceView,
  type ReleaseInsuranceOutcome,
} from "./release-figures";

function typed(value: Partial<InsurancePremiumValue>) {
  return releaseInsuranceQuery({ percentage: "", paymentType: "full", partialAmount: "", ...value });
}

/** The server's preview of a ₱15,000 loan with 2% insurance, ₱120 collected now. */
const PREVIEW: LoanReleasePreview = {
  deductions: [],
  total_deductions: "1250.00",
  net_proceeds: "13750.00",
  fee_fingerprint: "9f2c1e",
  insurance: { premium_amount: "300.00", collected: "120.00", partial_amount: "120.00", remaining_balance: "180.00" },
  total_deductions_after_insurance: "1370.00",
  net_proceeds_after_insurance: "13630.00",
  exceeds_net_proceeds: false,
};

describe("releaseInsuranceQuery", () => {
  test("no percentage, or 0%, is no insurance: nothing to ask about", () => {
    assert.equal(typed({}), null);
    assert.equal(typed({ percentage: "0" }), null);
    assert.equal(typed({ percentage: "0.00", paymentType: "partial", partialAmount: "50" }), null);
    assert.equal(typed({ percentage: "abc" }), null);
  });

  test("in full: the percentage as typed, and nothing collected separately", () => {
    assert.deepEqual(typed({ percentage: "2.25" }), {
      insurance_premium_percentage: 2.25,
      insurance_payment_type: "full",
    });
  });

  test("a partial amount typed in full mode is not sent", () => {
    assert.deepEqual(typed({ percentage: "2", partialAmount: "50" }), {
      insurance_premium_percentage: 2,
      insurance_payment_type: "full",
    });
  });

  test("partial: the amount collected now, as typed to the centavo", () => {
    assert.deepEqual(typed({ percentage: "2", paymentType: "partial", partialAmount: "120.5" }), {
      insurance_premium_percentage: 2,
      insurance_payment_type: "partial",
      insurance_partial_amount: 120.5,
    });
  });

  test("partial with nothing typed yet collects nothing now", () => {
    assert.equal(typed({ percentage: "2", paymentType: "partial" })?.insurance_partial_amount, 0);
    assert.equal(typed({ percentage: "2", paymentType: "partial", partialAmount: "-5" })?.insurance_partial_amount, 0);
  });

  test("the partial amount is rounded to the centavo as an input, never capped here", () => {
    // Capping is the server's to refuse (422) and the field's to tidy on blur.
    assert.equal(typed({ percentage: "2", paymentType: "partial", partialAmount: "120.456" })?.insurance_partial_amount, 120.46);
    assert.equal(typed({ percentage: "2", paymentType: "partial", partialAmount: "500" })?.insurance_partial_amount, 500);
  });
});

describe("releaseInsurancePayload", () => {
  test("with no insurance nothing is sent", () => {
    assert.deepEqual(releaseInsurancePayload(null, null), {});
    assert.deepEqual(releaseInsurancePayload(null, PREVIEW.insurance), {});
  });

  test("the previewed inputs go with the server's premium and remaining balance", () => {
    const query = typed({ percentage: "2", paymentType: "partial", partialAmount: "120" });
    assert.deepEqual(releaseInsurancePayload(query, PREVIEW.insurance), {
      insurance_premium_percentage: 2,
      insurance_payment_type: "partial",
      insurance_partial_amount: 120,
      insurance_premium_amount: 300,
      insurance_remaining_balance: 180,
    });
  });

  test("in full: the server's premium, nothing left", () => {
    const query = typed({ percentage: "1.5" });
    const insurance = { premium_amount: "150.02", collected: "150.02", partial_amount: null, remaining_balance: "0.00" };
    assert.deepEqual(releaseInsurancePayload(query, insurance), {
      insurance_premium_percentage: 1.5,
      insurance_payment_type: "full",
      insurance_premium_amount: 150.02,
      insurance_remaining_balance: 0,
    });
  });

  test("no premium from the server means nothing to send", () => {
    assert.deepEqual(releaseInsurancePayload(typed({ percentage: "2" }), null), {});
  });
});

describe("partialAmountOnBlur", () => {
  test("capped at the server's premium and rounded to the centavo", () => {
    assert.equal(partialAmountOnBlur("500", "300.00"), "300");
    assert.equal(partialAmountOnBlur("120.456", "300.00"), "120.46");
    assert.equal(partialAmountOnBlur("150.02", "150.02"), "150.02");
  });

  test("before the premium is known it is only rounded", () => {
    assert.equal(partialAmountOnBlur("500.009", null), "500.01");
    assert.equal(partialAmountOnBlur("500", undefined), "500");
  });

  test("nothing usable typed clears the field", () => {
    for (const raw of ["", "  ", "0", "-3", "abc"]) {
      assert.equal(partialAmountOnBlur(raw, "300.00"), "", JSON.stringify(raw));
    }
  });
});

describe("partialExceedsPremium", () => {
  test("only above the server's premium", () => {
    assert.equal(partialExceedsPremium("300.01", "300.00"), true);
    assert.equal(partialExceedsPremium("300", "300.00"), false);
    assert.equal(partialExceedsPremium("120", "300.00"), false);
  });

  test("never claimed before the premium is known", () => {
    assert.equal(partialExceedsPremium("1000000", null), false);
    assert.equal(partialExceedsPremium("", "300.00"), false);
  });
});

describe("releaseInsuranceView", () => {
  const query = typed({ percentage: "2" });
  const key = releaseInsuranceKey(7, query);
  const ready: ReleaseInsuranceOutcome = { key: key!, attempt: 0, view: { status: "ready", preview: PREVIEW } };

  test("idle with no insurance to ask about", () => {
    assert.equal(releaseInsuranceKey(7, null), null);
    assert.deepEqual(releaseInsuranceView(null, 0, ready), { status: "idle" });
  });

  test("loading until the answer for this insurance arrives", () => {
    assert.deepEqual(releaseInsuranceView(key, 0, null), { status: "loading" });
  });

  test("the server's figures once it answers for this insurance", () => {
    assert.deepEqual(releaseInsuranceView(key, 0, ready), { status: "ready", preview: PREVIEW });
  });

  test("an answer for another percentage, or another loan, is stale", () => {
    assert.deepEqual(releaseInsuranceView(releaseInsuranceKey(7, typed({ percentage: "3" })), 0, ready), {
      status: "loading",
    });
    assert.deepEqual(releaseInsuranceView(releaseInsuranceKey(8, query), 0, ready), { status: "loading" });
  });

  test("a retry waits for its own answer", () => {
    assert.deepEqual(releaseInsuranceView(key, 1, ready), { status: "loading" });
  });

  test("a refused insurance stays refused, with no figures to fall back on", () => {
    const failed: ReleaseInsuranceOutcome = { key: key!, attempt: 0, view: { status: "error", message: "Too much." } };
    assert.deepEqual(releaseInsuranceView(key, 0, failed), { status: "error", message: "Too much." });
  });
});

describe("releaseInsuranceFailureMessage", () => {
  test("a 422 is shown in the server's words", () => {
    const message = "The insurance partial amount may not be greater than the premium of ₱300.00.";
    assert.equal(
      releaseInsuranceFailureMessage({
        isAxiosError: true,
        response: { status: 422, data: { message, errors: { insurance_partial_amount: [message] } } },
      }),
      message,
    );
  });

  test("anything else falls back to a retry hint", () => {
    assert.match(releaseInsuranceFailureMessage(new Error("boom")), /try again/i);
  });
});
