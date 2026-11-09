import { test } from "node:test";
import assert from "node:assert/strict";
import type { JournalPreview } from "@/types";
import { balanceStatus, outByText, previewErrorMessage } from "./journal-balance";

function preview(over: Partial<JournalPreview> = {}): JournalPreview {
  return {
    total_debit: 150000,
    total_credit: 150000,
    difference: 0,
    out_by: 0,
    heavier_side: null,
    is_balanced: true,
    line_count: 2,
    ...over,
  };
}

test("the out-by text names the heavier side from the server", () => {
  assert.equal(
    outByText(preview({ out_by: 50000, heavier_side: "debit", is_balanced: false })),
    "Out by ₱500.00 (debits higher)",
  );
  assert.equal(
    outByText(preview({ out_by: 1, heavier_side: "credit", is_balanced: false })),
    "Out by ₱0.01 (credits higher)",
  );
});

test("the out-by text shows the server's out_by, never a difference of its own", () => {
  // `difference` deliberately disagrees: the text must read `out_by`.
  assert.equal(
    outByText(
      preview({ difference: -999, out_by: 2500, heavier_side: "credit", is_balanced: false }),
    ),
    "Out by ₱25.00 (credits higher)",
  );
});

test("a balanced preview reads Balanced", () => {
  const status = balanceStatus(preview(), null);
  assert.equal(status.tone, "balanced");
  assert.equal(status.title, "Balanced");
  assert.equal(status.detail, null);
});

test("an unbalanced preview reads Not balanced, with the out-by text", () => {
  const status = balanceStatus(
    preview({ total_credit: 100000, out_by: 50000, heavier_side: "debit", is_balanced: false }),
    null,
  );
  assert.equal(status.tone, "out");
  assert.equal(status.title, "Not balanced");
  assert.equal(status.detail, "Out by ₱500.00 (debits higher)");
});

test("nothing entered reads as waiting for amounts, not as Balanced", () => {
  // The server calls 0 = 0 balanced; the form must not.
  assert.equal(balanceStatus(preview({ total_debit: 0, total_credit: 0 }), null).tone, "empty");
  assert.equal(
    balanceStatus(preview({ total_debit: 0, total_credit: 0, line_count: 0 }), null).tone,
    "empty",
  );
});

test("no answer yet reads as checking; a failed answer says so", () => {
  assert.equal(balanceStatus(null, null).tone, "pending");
  const failed = balanceStatus(null, "An amount is too large.");
  assert.equal(failed.tone, "failed");
  assert.equal(failed.detail, "An amount is too large.");
});

test("one line, however even, is not Balanced", () => {
  assert.notEqual(balanceStatus(preview({ line_count: 1 }), null).tone, "balanced");
});

test("a preview refusal on one line names the line on screen, in words", () => {
  const err = {
    response: {
      status: 422,
      data: {
        message: "The lines.1.debit field must not be greater than 9007199254740992.",
        errors: { "lines.1.debit": ["The lines.1.debit field must not be greater than 9007199254740992."] },
      },
    },
  };
  // Sent line 1 is the third row on screen (a blank row was skipped).
  assert.equal(previewErrorMessage(err, [1, 3]), "Line 3: amount is too large or not valid.");
  // Without the row numbers, the sent position.
  assert.equal(previewErrorMessage(err, []), "Line 2: amount is too large or not valid.");
});

test("any other preview failure reads as the totals not being checked", () => {
  const status = balanceStatus(null, previewErrorMessage(new Error("boom"), []));
  assert.equal(status.tone, "failed");
  assert.match(status.detail ?? "", /couldn't be checked/i);
});
