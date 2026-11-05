import { test } from "node:test";
import assert from "node:assert/strict";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { cardDeductionsSource, cardFiguresAreEstimated } from "./deductions-preview";

test("the endpoint is the loan's deductions preview", () => {
  assert.equal(API_ENDPOINTS.LOANS.DEDUCTIONS_PREVIEW(7), "/loans/7/deductions-preview");
});

test("draft and for_review read the deductions preview, whoever is looking", () => {
  for (const canRelease of [true, false]) {
    assert.equal(cardDeductionsSource("draft", canRelease), "deductions-preview");
    assert.equal(cardDeductionsSource("for_review", canRelease), "deductions-preview");
  }
});

test("at approved, whoever can release keeps release-preview and everyone else reads this one", () => {
  assert.equal(cardDeductionsSource("approved", true), "release-preview");
  assert.equal(cardDeductionsSource("approved", false), "deductions-preview");
});

test("once released, the card reads what the loan recorded", () => {
  for (const status of ["released", "ongoing", "completed", "defaulted", "restructured", "rejected", "void"] as const) {
    assert.equal(cardDeductionsSource(status, true), "recorded");
    assert.equal(cardDeductionsSource(status, false), "recorded");
  }
});

test("the card says Estimated while the server calls the figures provisional", () => {
  assert.equal(cardFiguresAreEstimated("deductions-preview", { provisional: true }), true);
  assert.equal(cardFiguresAreEstimated("deductions-preview", { provisional: false }), false);
});

test("a preview with no provisional flag reads as an estimate, the cautious answer", () => {
  assert.equal(cardFiguresAreEstimated("deductions-preview", {}), true);
});

test("release-preview's figures and recorded figures are never called estimates", () => {
  assert.equal(cardFiguresAreEstimated("release-preview", {}), false);
  assert.equal(cardFiguresAreEstimated("recorded", {}), false);
  assert.equal(cardFiguresAreEstimated("recorded", null), false);
});
