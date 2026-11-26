import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADJUSTMENT_CANCEL_REASON_MAX,
  cancelAdjustmentDialog,
  cancelAllowed,
  cancellationLine,
  offersCancel,
} from "./adjustment-cancel";
import { ADJUSTMENT_STATUS_LABELS } from "@/constants";

test("Cancel shows on every approved adjustment the server reports on, whatever the user's permission", () => {
  assert.equal(offersCancel({ status: "approved", can_cancel: true }), true);
  // A user without loan_adjustments:approve gets can_cancel false: still shown, disabled with the reason.
  assert.equal(offersCancel({ status: "approved", can_cancel: false }), true);
  assert.equal(offersCancel({ status: "approved" }), false);
  for (const status of ["pending", "applied", "rejected", "cancelled"]) {
    assert.equal(offersCancel({ status, can_cancel: true }), false, status);
  }
});

test("Cancel is enabled only when the server says it can be cancelled now", () => {
  assert.equal(cancelAllowed({ status: "approved", can_cancel: true }), true);
  assert.equal(cancelAllowed({ status: "approved", can_cancel: false }), false);
  assert.equal(cancelAllowed({ status: "approved" }), false);
});

test("the dialog asks for a reason, names the type, and keeps to the server's 500 characters", () => {
  const copy = cancelAdjustmentDialog("Balance Adjustment");
  assert.equal(copy.title, "Cancel this balance adjustment?");
  assert.equal(copy.reasonLabel, "Reason");
  assert.equal(copy.reasonRequired, true);
  assert.equal(copy.confirmLabel, "Cancel Adjustment");
  assert.equal(cancelAdjustmentDialog(undefined).title, "Cancel this adjustment?");
  assert.equal(ADJUSTMENT_CANCEL_REASON_MAX, 500);
});

test("a cancelled adjustment reads Cancelled, with who, when and why", () => {
  assert.equal(ADJUSTMENT_STATUS_LABELS.cancelled, "Cancelled");

  const line = cancellationLine({
    status: "cancelled",
    cancellation_reason: "The member paid it down instead.",
    cancelled_at: "2026-11-25 14:05:00",
    cancelled_by_user: { id: 1, name: "Ana Reyes" },
  });
  assert.match(line ?? "", /^Cancelled by Ana Reyes on Nov 25, 2026, 0?2:05 PM: The member paid it down instead\.$/);

  assert.equal(cancellationLine({ status: "cancelled", cancellation_reason: "Duplicate request" }), "Cancelled: Duplicate request");
  assert.equal(cancellationLine({ status: "approved", cancellation_reason: "x" }), null);
});

test("the loan page offers Cancel through its dialog and shows the cancellation", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.match(page, /\{offersCancel\(adj\) && \(\s*<PermissionButton\s+permission=\{LOAN_ADJUSTMENT_DECIDE_GATE\.permission\}\s+tooltip="Your role doesn't have permission to cancel loan adjustments"/);
  assert.match(page, /disabled=\{actionLoading \|\| !cancelAllowed\(adj\)\}/);
  assert.doesNotMatch(page, /canDecideAdjustments/);
  assert.match(page, /\{\.\.\.cancelAdjustmentDialog\(/);
  assert.match(page, /maxLength=\{ADJUSTMENT_CANCEL_REASON_MAX\}/);
  assert.match(page, /await loanAdjustmentService\.cancel\(adjId, \{ reason \}\);/);
  assert.match(page, /cancellationLine\(adj\)/);
});
