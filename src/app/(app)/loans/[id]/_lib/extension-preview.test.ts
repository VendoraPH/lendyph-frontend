/**
 * The Extend dialog's figures, pinned against the server's preview.
 *
 * The dialog used to work out the interest a deferred extension would owe in
 * the browser (unpaid interest plus principal × rate). It now asks
 * `GET /loans/{id}/extension-preview` and only picks which of the server's
 * figures to show.
 *
 * WHAT THIS PROVES: every figure shown is the one the server sent, the
 * collection appears only for "pay" (its penalty part only when above zero),
 * and an answer that is incomplete or for the other option shows nothing.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's preview tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getErrorMessage } from "@/lib/api-error";
import {
  extensionPreviewAnswer,
  extensionPreviewKey,
  extensionPreviewState,
  readExtensionPreview,
} from "./extension-preview";

/** Figures that do not add up on purpose: the dialog repeats, it never checks. */
const PAY = {
  interest_option: "pay",
  collect_now: { amount: 3412.37, penalty_part: 112.37, interest_part: 3300 },
  carry_principal: 70000,
  carry_interest: 0,
  fresh_interest: 2100.01,
  new_interest_due: 2100.01,
  new_total_due: 72100.05,
  new_due_date: "2026-12-31",
};

const DEFER = {
  interest_option: "defer",
  collect_now: { amount: 0, penalty_part: 0, interest_part: 0 },
  carry_principal: 70000,
  carry_interest: 3000,
  fresh_interest: 3000,
  new_interest_due: 6000.5,
  new_total_due: 76000.5,
  new_due_date: "2027-01-31",
};

test("pay shows what is collected now, its penalty part, and the new period, as sent", () => {
  assert.deepEqual(readExtensionPreview(PAY, "pay"), {
    option: "pay",
    collectNow: { amount: 3412.37, penaltyPart: 112.37, interestPart: 3300 },
    carryInterest: 0,
    freshInterest: 2100.01,
    newInterestDue: 2100.01,
    newTotalDue: 72100.05,
    newDueDate: "2026-12-31",
  });
});

test("a collection with no penalty shows no penalty part", () => {
  const view = readExtensionPreview(
    { ...PAY, collect_now: { amount: 3300, penalty_part: 0, interest_part: 3300 } },
    "pay",
  );
  assert.deepEqual(view?.collectNow, { amount: 3300, penaltyPart: null, interestPart: 3300 });
});

test("defer collects nothing now and shows the carried and fresh interest", () => {
  assert.deepEqual(readExtensionPreview(DEFER, "defer"), {
    option: "defer",
    collectNow: null,
    carryInterest: 3000,
    freshInterest: 3000,
    newInterestDue: 6000.5,
    newTotalDue: 76000.5,
    newDueDate: "2027-01-31",
  });
});

test("decimal strings, as a decimal cast sends them, are read as their figures", () => {
  const view = readExtensionPreview({ ...DEFER, new_total_due: "76000.50" }, "defer");
  assert.equal(view?.newTotalDue, 76000.5);
});

test("an answer for the other option is not shown", () => {
  // A quick switch from pay to defer must never leave pay's figures under
  // the defer label.
  assert.equal(readExtensionPreview(PAY, "defer"), null);
  assert.equal(readExtensionPreview(DEFER, "pay"), null);
});

test("an incomplete or unreadable answer shows nothing, never a figure worked out here", () => {
  for (const key of ["carry_interest", "fresh_interest", "new_interest_due", "new_total_due", "new_due_date", "collect_now"] as const) {
    const rest: Record<string, unknown> = { ...PAY };
    delete rest[key];
    assert.equal(readExtensionPreview(rest, "pay"), null, key);
  }
  assert.equal(readExtensionPreview({ ...PAY, collect_now: { amount: 1 } }, "pay"), null);
  assert.equal(readExtensionPreview({ ...PAY, new_due_date: "next month" }, "pay"), null);
  assert.equal(readExtensionPreview({ ...PAY, new_total_due: "abc" }, "pay"), null);
  for (const junk of [undefined, null, "ok", [], 42]) {
    assert.equal(readExtensionPreview(junk, "pay"), null);
  }
});

// ── which answer the dialog shows ─────────────────────────────────────────

test("an answer is shown only for the option and round asked now", () => {
  const payKey = extensionPreviewKey({ loanId: 7, option: "pay", round: 1 })!;
  const answer = extensionPreviewAnswer(payKey, "pay", { data: PAY }, false)!;
  assert.deepEqual(extensionPreviewState(payKey, answer), {
    loading: false,
    preview: readExtensionPreview(PAY, "pay"),
    error: null,
  });
  // A late answer for the option switched away from, or for an earlier round
  // (before a failed extend asked again), is ignored: still loading.
  const deferKey = extensionPreviewKey({ loanId: 7, option: "defer", round: 1 })!;
  const nextRound = extensionPreviewKey({ loanId: 7, option: "pay", round: 2 })!;
  for (const key of [deferKey, nextRound]) {
    assert.deepEqual(extensionPreviewState(key, answer), { loading: true, preview: null, error: null });
  }
  // A closed dialog asks nothing and shows nothing.
  assert.equal(extensionPreviewKey(null), null);
  assert.deepEqual(extensionPreviewState(null, answer), { loading: false, preview: null, error: null });
});

test("an aborted request is ignored, so it neither shows nor reports anything", () => {
  const key = extensionPreviewKey({ loanId: 7, option: "pay", round: 1 })!;
  assert.equal(extensionPreviewAnswer(key, "pay", { data: PAY }, true), null);
  assert.equal(extensionPreviewAnswer(key, "pay", { error: new Error("canceled") }, true), null);
});

test("a refusal is shown as the server's message; an unreadable answer says so", () => {
  const key = extensionPreviewKey({ loanId: 7, option: "pay", round: 1 })!;
  const refusal = { isAxiosError: true, response: { status: 422, data: { message: "This loan cannot be extended." } } };
  assert.deepEqual(extensionPreviewAnswer(key, "pay", { error: refusal }, false), {
    key,
    preview: null,
    error: getErrorMessage(refusal, "We couldn't preview this extension. Please try again."),
    failed: true,
  });
  assert.deepEqual(extensionPreviewAnswer(key, "pay", { data: { nope: true } }, false), {
    key,
    preview: null,
    error: "The server's extension preview could not be read.",
    failed: false,
  });
});
