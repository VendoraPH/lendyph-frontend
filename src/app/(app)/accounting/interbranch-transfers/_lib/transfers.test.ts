import { test } from "node:test";
import assert from "node:assert/strict";
import type { InterbranchTransfer, InterbranchTransferActions } from "@/types/interbranch-transfer";
import {
  EMPTY_TRANSFER_FORM,
  NOTE_LIMITS,
  buildTransferInput,
  canSendBack,
  sendBackForm,
  stepRefreshes,
  transferBranchOptions,
  transferActionButtons,
  transferFailure,
  transferStatusLabel,
} from "./transfers";

const none: InterbranchTransferActions = {
  can_approve: false,
  can_reject: false,
  can_cancel: false,
  can_receive: false,
  can_reverse: false,
};

function transfer(over: Partial<InterbranchTransfer> = {}): InterbranchTransfer {
  return {
    id: 7,
    transfer_number: "IBT-000007",
    status: "received",
    status_label: "Received",
    source_branch: { id: 1, name: "Main", code: "MAIN" },
    destination_branch: { id: 2, name: "North", code: "NTH" },
    from_account: { id: 11, code: "1010", name: "Cash on Hand" },
    to_account: { id: 12, code: "1040", name: "Cash in Bank" },
    clearing_account: { id: 19, code: "1190", name: "Interbranch Clearing" },
    amount: 1250050,
    purpose: "Cash for releases",
    reference: null,
    age_days: null,
    created_by: { id: 3, full_name: "Ana Cruz" },
    created_at: "2026-11-19T01:00:00Z",
    approved_by: null,
    approved_at: null,
    received_by: null,
    received_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_note: null,
    cancelled_at: null,
    reversed_by: null,
    reversed_at: null,
    reversal_reason: null,
    dispatch_journal: null,
    receipt_journal: null,
    dispatch_reversal_journal: null,
    actions: none,
    ...over,
  };
}

// ── Actions come only from the server's `actions` ──

test("no action is offered when the server allows none", () => {
  assert.deepEqual(transferActionButtons(none), []);
});

test("each action shows only when the server says the caller may take it, in a fixed order", () => {
  const all = { can_approve: true, can_reject: true, can_cancel: true, can_receive: true, can_reverse: true };
  assert.deepEqual(
    transferActionButtons(all).map((a) => [a.kind, a.label]),
    [
      ["approve", "Approve and send"],
      ["receive", "Receive"],
      ["reject", "Reject"],
      ["cancel", "Cancel"],
      ["reverse", "Reverse"],
    ],
  );
  assert.deepEqual(transferActionButtons({ ...none, can_receive: true }).map((a) => a.kind), ["receive"]);
});

test("approve, receive and reverse post money, so they carry an Idempotency-Key; reject and reverse ask for words", () => {
  const all = { can_approve: true, can_reject: true, can_cancel: true, can_receive: true, can_reverse: true };
  const byKind = new Map(transferActionButtons(all).map((a) => [a.kind, a]));
  assert.equal(byKind.get("approve")!.posts, true);
  assert.equal(byKind.get("receive")!.posts, true);
  assert.equal(byKind.get("reverse")!.posts, true);
  assert.equal(byKind.get("reject")!.posts, false);
  assert.equal(byKind.get("cancel")!.posts, false);
  assert.deepEqual(byKind.get("reject")!.text, { field: "note", label: "Why it's rejected", max: 500 });
  assert.deepEqual(byKind.get("reverse")!.text, { field: "reason", label: "Why it's reversed", max: 300 });
  assert.equal(byKind.get("approve")!.text, null);
  assert.deepEqual(NOTE_LIMITS, { note: 500, reason: 300 });
});

test("a status reads the server's label, and in words when the label is missing", () => {
  assert.equal(transferStatusLabel(transfer({ status: "in_transit", status_label: "In transit" })), "In transit");
  assert.equal(transferStatusLabel(transfer({ status: "pending_approval", status_label: "" })), "Pending approval");
});

// ── Send back ──

test("Send back is offered on a received transfer to someone who can make transfers", () => {
  assert.equal(canSendBack(transfer(), true), true);
  assert.equal(canSendBack(transfer(), false), false);
  assert.equal(canSendBack(transfer({ status: "in_transit" }), true), false);
  assert.equal(canSendBack(transfer({ source_branch: null }), true), false);
});

test("Send back pre-fills a new transfer the other way, for the same amount, naming the original", () => {
  assert.deepEqual(sendBackForm(transfer()), {
    sourceBranchId: 2,
    destinationBranchId: 1,
    fromAccountId: 12,
    toAccountId: 11,
    amount: "12500.50",
    purpose: "Sending back IBT-000007: Cash for releases",
    reference: "IBT-000007",
  });
});

test("the send-back purpose stays within the server's 500 characters", () => {
  const long = sendBackForm(transfer({ purpose: "x".repeat(500) }));
  assert.ok(long.purpose.length <= 500);
  assert.match(long.purpose, /^Sending back IBT-000007/);
});

// ── The create form ──

test("a complete form becomes the server's body, the amount in centavos and the words trimmed", () => {
  const result = buildTransferInput({
    sourceBranchId: 1,
    destinationBranchId: 2,
    fromAccountId: 11,
    toAccountId: 12,
    amount: "₱12,500.50",
    purpose: "  Cash for releases ",
    reference: "  ",
  });
  assert.deepEqual(result, {
    ok: true,
    input: {
      source_branch_id: 1,
      destination_branch_id: 2,
      from_account_id: 11,
      to_account_id: 12,
      amount: 1250050,
      purpose: "Cash for releases",
    },
  });
});

test("each missing or wrong part is named in words, field by field", () => {
  const result = buildTransferInput({ ...EMPTY_TRANSFER_FORM, sourceBranchId: 1, destinationBranchId: 1, amount: "0" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors, {
    destinationBranchId: "The money has to go to a different branch.",
    fromAccountId: "Choose the account the money leaves from.",
    toAccountId: "Choose the account the money arrives in.",
    amount: "Enter an amount above ₱0.00.",
    purpose: "Say what the transfer is for.",
  });
});

test("an amount with more than two decimals, and over-long words, are refused before sending", () => {
  const base = { sourceBranchId: 1, destinationBranchId: 2, fromAccountId: 11, toAccountId: 12, purpose: "Cash" };
  const tooFine = buildTransferInput({ ...base, amount: "10.555", reference: "" });
  assert.equal(!tooFine.ok && tooFine.errors.amount, "Enter the amount in pesos, with at most two decimals.");
  const longRef = buildTransferInput({ ...base, amount: "10", reference: "r".repeat(65) });
  assert.equal(!longRef.ok && longRef.errors.reference, "The reference can be at most 64 characters.");
  const longPurpose = buildTransferInput({ ...base, amount: "10", reference: "", purpose: "p".repeat(501) });
  assert.equal(!longPurpose.ok && longPurpose.errors.purpose, "The purpose can be at most 500 characters.");
});

// ── The server's refusals ──

function refusal(status: number, errors?: Record<string, string[]>, message?: string) {
  return { isAxiosError: true, response: { status, data: { message, ...(errors ? { errors } : {}) } } };
}

test("a refused field shows beside that field, in the server's words", () => {
  const failure = transferFailure(
    refusal(422, {
      destination_branch_id: ["The money has to go to a different branch."],
      from_account_id: ["Cash in Bank isn't a money account."],
    }),
  );
  assert.deepEqual(failure.fields, {
    destinationBranchId: "The money has to go to a different branch.",
    fromAccountId: "Cash in Bank isn't a money account.",
  });
  assert.equal(failure.general, null);
});

test("a refusal of the step itself, or a closed branch, shows above the buttons in its words", () => {
  const words = "A received transfer can't be reversed. To send the money back, make a new transfer from North to Main.";
  assert.deepEqual(transferFailure(refusal(422, { transfer: [words] }, words)), { fields: {}, general: words });
  const maker = transferFailure(refusal(403, undefined, "The person who made a transfer can't approve it."));
  assert.equal(maker.general, "The person who made a transfer can't approve it.");
});

test("a 409 says someone else changed it first", () => {
  const conflict = transferFailure(
    refusal(409, undefined, "Another change to this transfer was saved at the same moment. Reload it and try again."),
  );
  assert.match(conflict.general ?? "", /Reload it and try again/);
});

// ── Which branches a transfer can use ──

test("a transfer can use active and suspended branches, never closed ones; a suspended one is marked", () => {
  const listed = [
    { id: 1, name: "Main", code: "MAIN", is_active: true, status: "active" as const },
    { id: 2, name: "North", code: "NTH", is_active: false, status: "suspended" as const },
    { id: 3, name: "South", code: "STH", is_active: false, status: "closed" as const },
    { id: 4, name: "East", code: "EST", is_active: true },
    { id: 5, name: "West", code: "WST", is_active: false },
  ];
  const all = transferBranchOptions(listed, { viewAll: true, own: [] });
  // One set of brackets: the code; a suspended branch adds "· Suspended".
  assert.deepEqual(all.sources.map((b) => [b.id, b.label]), [
    [1, "Main (MAIN)"],
    [2, "North (NTH) · Suspended"],
    [4, "East (EST)"],
    // An older answer with no status: inactive reads as suspended (branchStatusOf).
    [5, "West (WST) · Suspended"],
  ]);
  for (const b of all.sources) assert.equal((b.label.match(/\(/g) ?? []).length, 1, b.label);
  assert.deepEqual(all.destinations.map((b) => b.id), [1, 2, 4, 5]);

  // A branch user sends only from their own branches (still never a closed
  // one), and may send to any branch that isn't closed.
  const own = [
    { id: 2, name: "North", code: "NTH" },
    { id: 3, name: "South", code: "STH" },
  ];
  const branchUser = transferBranchOptions(listed, { viewAll: false, own });
  assert.deepEqual(branchUser.sources.map((b) => [b.id, b.label]), [[2, "North (NTH) · Suspended"]]);
  assert.deepEqual(branchUser.destinations.map((b) => b.id), [1, 2, 4, 5]);
});

test("a label without a code has no brackets at all", () => {
  const { sources } = transferBranchOptions([{ id: 9, name: "Kiosk", code: "", is_active: false, status: "suspended" }], {
    viewAll: true,
    own: [],
  });
  assert.equal(sources[0].label, "Kiosk · Suspended");
});

// ── What a step refreshes ──

test("every successful step reloads the list, the in-transit report and the branch counts", () => {
  for (const step of ["create", "approve", "receive", "reject", "cancel", "reverse"] as const) {
    assert.deepEqual(stepRefreshes(step), { list: true, inTransit: true, counts: true }, step);
  }
});
