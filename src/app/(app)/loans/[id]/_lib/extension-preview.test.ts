/**
 * The Extend dialog's figures, pinned against the server's preview.
 *
 * The dialog used to work out the interest a deferred extension would owe in
 * the browser (unpaid interest plus principal × rate). It now asks
 * `GET /loans/{id}/extension-preview` and only picks which of the server's
 * figures to show.
 *
 * WHAT THIS PROVES: every figure shown is the one the server sent, the
 * collection appears only for "pay" (premium, penalty, interest and total,
 * the premium only when above ₱0.00, each a dash when missing), Confirm waits
 * for the total, and an answer whose new-period figures are incomplete, or
 * that is for the other option, shows nothing.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's preview tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getErrorMessage } from "@/lib/api-error";
import {
  extensionPreviewAnswer,
  extensionPreviewKey,
  canConfirmExtension,
  collectNowRows,
  extensionCycleUnit,
  extensionCyclesLabel,
  extensionCyclesSentence,
  extensionMoveDescription,
  extensionPreviewState,
  freshInterestLabel,
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
    collectNow: { amount: 3412.37, penaltyPart: 112.37, interestPart: 3300, insurancePart: 0 },
    carryInterest: 0,
    freshInterest: 2100.01,
    newInterestDue: 2100.01,
    newTotalDue: 72100.05,
    newDueDate: "2026-12-31",
    cycles: null,
  });
});

test("a collection with no penalty shows the penalty as ₱0.00, as sent", () => {
  const view = readExtensionPreview(
    { ...PAY, collect_now: { amount: 3300, penalty_part: 0, interest_part: 3300 } },
    "pay",
  );
  assert.deepEqual(view?.collectNow, { amount: 3300, penaltyPart: 0, interestPart: 3300, insurancePart: 0 });
});

test("pay shows the insurance premium it collects first, as sent", () => {
  // ₱400 premium still owed on the loan: the same payment takes it before
  // the penalty and the interest. The amount is the server's, never added up.
  const view = readExtensionPreview(
    { ...PAY, collect_now: { amount: 3812.37, insurance_part: 400, penalty_part: 112.37, interest_part: 3300 } },
    "pay",
  );
  assert.deepEqual(view?.collectNow, { amount: 3812.37, penaltyPart: 112.37, interestPart: 3300, insurancePart: 400 });
  assert.equal(
    readExtensionPreview({ ...PAY, collect_now: { ...PAY.collect_now, insurance_part: "400.50" } }, "pay")?.collectNow
      ?.insurancePart,
    400.5,
  );
});

test("no insurance premium when none is owed or the server sent none", () => {
  for (const insurance_part of [0, "0.00", undefined, null]) {
    const view = readExtensionPreview({ ...PAY, collect_now: { ...PAY.collect_now, insurance_part } }, "pay");
    assert.equal(view?.collectNow?.insurancePart, 0, String(insurance_part));
  }
});

test("a part missing or unreadable is a dash, never a figure worked out here", () => {
  // Backend #213: a total of ₱3,412.37 sent without its interest part. The
  // interest is not the total minus the penalty here; it is a dash.
  const noInterest = readExtensionPreview(
    { ...PAY, collect_now: { amount: 3412.37, penalty_part: 112.37 } },
    "pay",
  );
  assert.deepEqual(noInterest?.collectNow, { amount: 3412.37, penaltyPart: 112.37, interestPart: null, insurancePart: 0 });
  const junk = readExtensionPreview(
    { ...PAY, collect_now: { amount: "abc", insurance_part: "abc", penalty_part: "", interest_part: {} } },
    "pay",
  );
  assert.deepEqual(junk?.collectNow, { amount: null, penaltyPart: null, interestPart: null, insurancePart: null });
  const none = readExtensionPreview({ ...PAY, collect_now: undefined }, "pay");
  assert.deepEqual(none?.collectNow, { amount: null, penaltyPart: null, interestPart: null, insurancePart: 0 });
});

test("the collection's rows: premium only when above ₱0.00, then penalty and interest, as sent", () => {
  assert.deepEqual(
    collectNowRows({ amount: 3812.37, insurancePart: 400, penaltyPart: 112.37, interestPart: 3300 }),
    [
      { label: "Insurance premium", amount: 400 },
      { label: "Late penalty", amount: 112.37 },
      { label: "Interest", amount: 3300 },
    ],
  );
  assert.deepEqual(collectNowRows({ amount: 3300, insurancePart: 0, penaltyPart: 0, interestPart: 3300 }), [
    { label: "Late penalty", amount: 0 },
    { label: "Interest", amount: 3300 },
  ]);
  // Sent but unreadable premium: a dash on its own row, not left out.
  assert.deepEqual(collectNowRows({ amount: null, insurancePart: null, penaltyPart: null, interestPart: null }), [
    { label: "Insurance premium", amount: null },
    { label: "Late penalty", amount: null },
    { label: "Interest", amount: null },
  ]);
  assert.deepEqual(collectNowRows(null), []);
});

test("Confirm waits for the total collected on pay; defer needs only the preview", () => {
  assert.equal(canConfirmExtension(readExtensionPreview(PAY, "pay")), true);
  assert.equal(canConfirmExtension(readExtensionPreview(DEFER, "defer")), true);
  assert.equal(
    canConfirmExtension(readExtensionPreview({ ...PAY, collect_now: { penalty_part: 0, interest_part: 3300 } }, "pay")),
    false,
  );
  // A missing part only shows a dash; the total is what is collected.
  assert.equal(
    canConfirmExtension(readExtensionPreview({ ...PAY, collect_now: { amount: 3300, interest_part: 3300 } }, "pay")),
    true,
  );
  assert.equal(canConfirmExtension(null), false);
});

test("defer reads without a collection: it collects nothing", () => {
  const rest: Record<string, unknown> = { ...DEFER };
  delete rest.collect_now;
  assert.equal(readExtensionPreview(rest, "defer")?.collectNow, null);
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
    cycles: null,
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
  for (const key of ["carry_interest", "fresh_interest", "new_interest_due", "new_total_due", "new_due_date"] as const) {
    const rest: Record<string, unknown> = { ...PAY };
    delete rest[key];
    assert.equal(readExtensionPreview(rest, "pay"), null, key);
  }
  assert.equal(readExtensionPreview({ ...PAY, new_due_date: "next month" }, "pay"), null);
  assert.equal(readExtensionPreview({ ...PAY, new_total_due: "abc" }, "pay"), null);
  for (const junk of [undefined, null, "ok", [], 42]) {
    assert.equal(readExtensionPreview(junk, "pay"), null);
  }
});

// ── how far the due date moves (decision 4a) ─────────────────────────────

test("the server's cycle count and new due date are shown as sent", () => {
  // An overdue loan anchored on the 27th, due 27 May and extended on 2 Nov,
  // moves six cycles to 27 Nov (the backend's own example).
  const view = readExtensionPreview({ ...PAY, cycles: 6, new_due_date: "2026-11-27" }, "pay");
  assert.equal(view?.cycles, 6);
  assert.equal(view?.newDueDate, "2026-11-27");
  assert.equal(readExtensionPreview({ ...DEFER, cycles: "1" }, "defer")?.cycles, 1);
});

test("an answer without cycles still shows its figures, with a dash for the cycles", () => {
  const view = readExtensionPreview({ ...PAY, cycles: null }, "pay");
  assert.equal(view?.cycles, null);
  assert.equal(extensionCyclesLabel(view?.cycles ?? null, "month"), "—");
  assert.equal(extensionCyclesSentence(null, "month"), null);
  assert.equal(freshInterestLabel(null, "month"), "New interest charged");
});

test("cycles sent but unreadable shows nothing, never a count worked out here", () => {
  for (const junk of [0, -1, 1.5, "abc", "", true, {}]) {
    assert.equal(readExtensionPreview({ ...PAY, cycles: junk }, "pay"), null, String(junk));
  }
});

test("months for monthly and upon-maturity loans, cycles for any other frequency", () => {
  assert.equal(extensionCycleUnit("upon_maturity"), "month");
  assert.equal(extensionCycleUnit("monthly"), "month");
  assert.equal(extensionCycleUnit("weekly"), "cycle");
  assert.equal(extensionCycleUnit("semi_monthly"), "cycle");
  assert.equal(extensionCycleUnit(undefined), "cycle");
});

test("the wording names the months moved and the interest they add to the new period", () => {
  // Added to the new period, never "collected": on "pay" the sentence must
  // not read as six months of interest taken now.
  assert.equal(extensionCyclesLabel(1, "month"), "1 month");
  assert.equal(extensionCyclesLabel(6, "month"), "6 months");
  assert.equal(
    extensionCyclesSentence(6, "month"),
    "Moves the due date 6 months: interest for 6 months is added to the new period.",
  );
  assert.equal(
    extensionCyclesSentence(1, "month"),
    "Moves the due date 1 month: interest for 1 month is added to the new period.",
  );
  assert.equal(
    extensionCyclesSentence(3, "cycle"),
    "Moves the due date 3 cycles: interest for 3 cycles is added to the new period.",
  );
  assert.equal(freshInterestLabel(6, "month"), "Interest for 6 months");
  assert.equal(freshInterestLabel(1, "cycle"), "Interest for 1 cycle");
});

test("the opening line says one cycle forward; the overdue clause waits for the server's cycles", () => {
  // A loan not yet due still moves one cycle (27 Nov to 27 Dec), so the line
  // never says "the first due date after today".
  assert.equal(extensionMoveDescription(null, "month"), "This moves the loan's due date one month forward.");
  assert.equal(
    extensionMoveDescription(1, "month"),
    "This moves the loan's due date one month forward. When the loan is overdue, it moves as many months as needed to land after today, and each month moved is charged interest.",
  );
  assert.equal(
    extensionMoveDescription(6, "cycle"),
    "This moves the loan's due date one cycle forward. When the loan is overdue, it moves as many cycles as needed to land after today, and each cycle moved is charged interest.",
  );
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
