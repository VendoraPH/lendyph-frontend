import { test } from "node:test";
import assert from "node:assert/strict";
import { LOANS_VIEW_REASON, loanFigureReason, pesosOrDash } from "./money";

test("a server peso figure reads in ₱ with two decimals, and a null one reads a dash", () => {
  assert.equal(pesosOrDash("1745.50"), "₱1,745.50");
  assert.equal(pesosOrDash("0.00"), "₱0.00");
  assert.equal(pesosOrDash(null), "—");
  assert.equal(pesosOrDash(undefined), "—");
});

test("a figure the server withholds (null without loans:view) says why; a sent one, ₱0.00 included, doesn't", () => {
  assert.equal(loanFigureReason(null), LOANS_VIEW_REASON);
  assert.match(LOANS_VIEW_REASON, /view loans/);
  assert.equal(loanFigureReason("0.00"), null);
  assert.equal(loanFigureReason(0), null);
  assert.equal(loanFigureReason(undefined), null);
});
