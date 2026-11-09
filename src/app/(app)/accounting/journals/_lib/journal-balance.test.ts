import { test } from "node:test";
import assert from "node:assert/strict";
import type { JournalPreview } from "@/types";
import { balanceStatus, outByText } from "./journal-balance";

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
