/**
 * The "Extend loan?" prompt on an upon-maturity partial payment.
 *
 * Its "No, thanks" button used to record the payment as a partial one, so
 * the only way out without recording anything was Escape. It now has three
 * buttons, each with one outcome.
 *
 * WHAT THIS PROVES: Cancel (and closing the prompt any other way) records
 * nothing, "Record partial payment" records the payment without extending,
 * and "Yes, extend" records it and extends.
 * WHAT IT DOES NOT PROVE: the requests themselves; the page sends them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARTIAL_EXTEND_LABELS,
  dispatchPartialExtend,
  partialExtendOnOpenChange,
  partialExtendOutcome,
} from "./partial-extend";

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
