/**
 * The "Extend loan?" prompt on a partial payment, on the loan page and on
 * Payment Entry.
 *
 * Its "No, thanks" button used to record the payment as a partial one, so
 * the only way out without recording anything was Escape. It now has three
 * buttons, each with one outcome.
 *
 * WHAT THIS PROVES: only a loan the server says can be extended
 * (`is_one_month_term`) asks, never a defaulted one; Cancel (and closing the
 * prompt any other way) records nothing, "Record partial payment" records the
 * payment without extending, and "Yes, extend" records it and extends on
 * "defer"; both pages and the shared prompt use these rules.
 * WHAT IT DOES NOT PROVE: the requests themselves; the pages send them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTIAL_EXTEND_LABELS,
  dispatchPartialExtend,
  offersExtendOnPartialPayment,
  partialExtendOnOpenChange,
  partialExtendOutcome,
  partialExtendPayload,
} from "./partial-extend";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("only a loan the server says can be extended asks on a partial payment", () => {
  assert.equal(offersExtendOnPartialPayment({ is_one_month_term: true, status: "released" }), true);
  assert.equal(offersExtendOnPartialPayment({ is_one_month_term: true, status: "ongoing" }), true);
  // A three-month upon-maturity loan can't be extended: its partial payment is recorded as is.
  assert.equal(offersExtendOnPartialPayment({ is_one_month_term: false, status: "released" }), false);
  // Not sent (a list row, an older payload): never assumed.
  assert.equal(offersExtendOnPartialPayment({ status: "released" }), false);
  assert.equal(offersExtendOnPartialPayment({ is_one_month_term: null, status: "ongoing" }), false);
});

test("a defaulted loan's partial payment is a recovery payment, recorded as is", () => {
  assert.equal(offersExtendOnPartialPayment({ is_one_month_term: true, status: "defaulted" }), false);
  // Nor does a loan that takes no payment at all.
  for (const status of ["completed", "approved", "void", null, undefined]) {
    assert.equal(offersExtendOnPartialPayment({ is_one_month_term: true, status }), false, String(status));
  }
});

test("Yes, extend extends on defer, since the payment was just recorded, and names it in pesos", () => {
  assert.deepEqual(partialExtendPayload(500), {
    remarks: "Auto-extend on partial payment of ₱500.00",
    interest_option: "defer",
  });
  assert.equal(partialExtendPayload(1234.5).remarks, "Auto-extend on partial payment of ₱1,234.50");
});

test("the loan page asks only by the shared rule, and extends with the shared request", () => {
  const page = read("src/app/(app)/loans/[id]/page.tsx");
  assert.match(
    page,
    /if \(paymentMode === "regular" && offersExtendOnPartialPayment\(loan\)\) \{\s*const decision = shouldPromptExtend\(/,
  );
  assert.doesNotMatch(page, /isUponMaturityLoan && paymentMode === "regular"/);
  assert.match(page, /loanService\.extend\(loan\.id, partialExtendPayload\(payload\.amount_paid\)\)/);
  assert.match(page, /<PartialExtendPrompt\b/);
  assert.doesNotMatch(page, /<AlertDialogTitle>Extend loan\?<\/AlertDialogTitle>/);
});

test("Payment Entry asks the same on an eligible loan's partial payment, and extends the same way", () => {
  const page = read("src/app/(app)/payments/page.tsx");
  assert.match(page, /const step = postPaymentStep\(selectedLoan, currentPreview\);/);
  assert.match(page, /<PartialExtendPrompt\b/);
  assert.match(page, /dispatchPartialExtend\(choice, payment, \{/);
  assert.match(page, /loanService\.extend\(loanId, partialExtendPayload\(amount\)\)/);
});

test("the shared prompt has the three buttons, and Yes, extend needs loans:extend", () => {
  const prompt = read("src/components/loans/partial-extend-prompt.tsx");
  assert.match(prompt, /<AlertDialogTitle>Extend loan\?<\/AlertDialogTitle>/);
  assert.match(prompt, /\{PARTIAL_EXTEND_LABELS\.cancel\}/);
  assert.match(prompt, /\{PARTIAL_EXTEND_LABELS\.record\}/);
  assert.match(
    prompt,
    /<PermissionButton\s+permission=\{LOAN_EXTEND_GATE\.permission\}\s+tooltip=\{LOAN_EXTEND_GATE\.tooltip\}[\s\S]*?\{PARTIAL_EXTEND_LABELS\.extend\}/,
  );
  assert.match(prompt, /partialExtendOnOpenChange\(next\)/);
});

test("Cancel records nothing and extends nothing", () => {
  assert.deepEqual(partialExtendOutcome("cancel"), { recordPayment: false, extend: false });
});

test("Record partial payment records the payment and does not extend", () => {
  assert.deepEqual(partialExtendOutcome("record"), { recordPayment: true, extend: false });
});

test("Yes, extend records the payment and extends", () => {
  assert.deepEqual(partialExtendOutcome("extend"), { recordPayment: true, extend: true });
});

test("each choice has its own button label, and none is 'No, thanks'", () => {
  assert.equal(PARTIAL_EXTEND_LABELS.cancel, "Cancel");
  assert.equal(PARTIAL_EXTEND_LABELS.record, "Record partial payment");
  assert.equal(PARTIAL_EXTEND_LABELS.extend, "Yes, extend");
  assert.ok(!Object.values(PARTIAL_EXTEND_LABELS).includes("No, thanks"));
});

test("closing the prompt any other way (Escape, outside click) is Cancel", () => {
  assert.equal(partialExtendOnOpenChange(false), "cancel");
  assert.equal(partialExtendOnOpenChange(true), null);
});

/** Records which action ran, with what. */
function spyActions() {
  const calls: string[] = [];
  return {
    calls,
    actions: {
      record: async (p: { amount_paid: number }) => {
        calls.push(`record ${p.amount_paid}`);
      },
      recordAndExtend: async (p: { amount_paid: number }) => {
        calls.push(`recordAndExtend ${p.amount_paid}`);
      },
    },
  };
}

test("dispatchPartialExtend: Cancel never records the payment", async () => {
  const { calls, actions } = spyActions();
  await dispatchPartialExtend("cancel", { amount_paid: 500 }, actions);
  await dispatchPartialExtend(partialExtendOnOpenChange(false)!, { amount_paid: 500 }, actions);
  assert.deepEqual(calls, []);
});

test("dispatchPartialExtend: Record partial payment records once, without extending", async () => {
  const { calls, actions } = spyActions();
  await dispatchPartialExtend("record", { amount_paid: 500 }, actions);
  assert.deepEqual(calls, ["record 500"]);
});

test("dispatchPartialExtend: Yes, extend records and extends", async () => {
  const { calls, actions } = spyActions();
  await dispatchPartialExtend("extend", { amount_paid: 500 }, actions);
  assert.deepEqual(calls, ["recordAndExtend 500"]);
});

test("dispatchPartialExtend: nothing runs once the pending payment is gone", async () => {
  const { calls, actions } = spyActions();
  await dispatchPartialExtend("record", null, actions);
  await dispatchPartialExtend("extend", null, actions);
  assert.deepEqual(calls, []);
});
