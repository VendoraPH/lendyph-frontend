import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chargePreviewFigures,
  chargePreviewView,
  previewFailureView,
  type ChargePreviewOutcome,
} from "./charge-preview";

const PREVIEW = { type: "cash_in" as const, amount: 1500, charge_amount: 15, total_amount: 1515 };
const READY: ChargePreviewOutcome = { amount: 1500, attempt: 0, view: { status: "ready", preview: PREVIEW } };

function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data },
  });
}

test("nothing to preview until a positive amount is entered", () => {
  for (const amount of [0, -5, Number.NaN]) {
    assert.deepEqual(chargePreviewView(amount, 0, READY), { status: "idle" });
  }
});

test("loading until the preview for this exact amount has come back", () => {
  assert.deepEqual(chargePreviewView(1500, 0, null), { status: "loading" });
  // A preview for an earlier amount is stale, never shown for the new one.
  assert.deepEqual(chargePreviewView(2000, 0, READY), { status: "loading" });
});

test("a retry waits for its own answer, not the failure it retries", () => {
  const failed: ChargePreviewOutcome = { amount: 1500, attempt: 0, view: { status: "error", message: "x" } };
  assert.deepEqual(chargePreviewView(1500, 1, failed), { status: "loading" });
});

test("the current preview is shown as the server sent it", () => {
  assert.deepEqual(chargePreviewView(1500, 0, READY), { status: "ready", preview: PREVIEW });
});

test("a 422 naming the tiers is the no-tier case", () => {
  const msg = "No tier matches amount 999999. Check the configured tier ranges.";
  assert.deepEqual(previewFailureView(httpError(422, { message: msg, errors: { amount: [msg] } })), {
    status: "no_tier",
  });
});

test("any other 422 shows the server's reason for the amount", () => {
  const msg = "The amount field must have 0-2 decimal places.";
  assert.deepEqual(previewFailureView(httpError(422, { message: msg, errors: { amount: [msg] } })), {
    status: "invalid",
    message: msg,
  });
});

test("anything else is an error that can be retried", () => {
  const view = previewFailureView(httpError(500, { message: "Server Error" }));
  assert.equal(view.status, "error");
});

test("a 403 says the role can't record GCash, with nothing to retry", () => {
  assert.deepEqual(previewFailureView(httpError(403, { message: "This action is unauthorized." })), {
    status: "forbidden",
    message: "You don't have permission to record GCash transactions.",
  });
});

test("the cash_out 422 shows the server's message, centavos and all", () => {
  const msg = "Amount must be more than the ₱10.50 charge.";
  assert.deepEqual(previewFailureView(httpError(422, { message: msg, errors: { amount: [msg] } })), {
    status: "invalid",
    message: msg,
  });
});

// The dialogs show the server's figures to the centavo: a ₱10.50 charge is
// ₱10.50, never rounded to ₱11.
test("the charge and total are shown to the centavo", () => {
  const preview = { type: "cash_in" as const, amount: 1000, charge_amount: 10.5, total_amount: 1010.5 };
  assert.deepEqual(chargePreviewFigures({ status: "ready", preview }), {
    charge: "₱10.50",
    total: "₱1,010.50",
  });
});

test("a Cash Out total is the server's, to the centavo", () => {
  const preview = { type: "cash_out" as const, amount: 20.25, charge_amount: 10.5, total_amount: 9.75 };
  assert.deepEqual(chargePreviewFigures({ status: "ready", preview }), {
    charge: "₱10.50",
    total: "₱9.75",
  });
});

test("whole-peso figures keep their plain form", () => {
  assert.deepEqual(chargePreviewFigures({ status: "ready", preview: PREVIEW }), {
    charge: "₱15",
    total: "₱1,515",
  });
});

test("no figures until the preview for this amount is in", () => {
  assert.deepEqual(chargePreviewFigures({ status: "idle" }), { charge: "—", total: "—" });
  assert.deepEqual(chargePreviewFigures({ status: "loading" }), {
    charge: "Calculating…",
    total: "Calculating…",
  });
  assert.deepEqual(chargePreviewFigures({ status: "no_tier" }), { charge: "No tier", total: "—" });
  assert.deepEqual(chargePreviewFigures({ status: "invalid", message: "x" }), { charge: "—", total: "—" });
  assert.deepEqual(chargePreviewFigures({ status: "error", message: "x" }), { charge: "—", total: "—" });
});
