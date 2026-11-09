/**
 * Which loans' approval chains the loan page reads.
 *
 * WHAT THIS PROVES: a voided loan's chain is still read (read only), so
 * Workflow History can show the steps its void cancelled; a rejected loan's is
 * not; and the chain card stays hidden for both.
 * WHAT IT DOES NOT PROVE: the chain itself (server-owned).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isApprovalChainHidden, readsApprovalChain } from "./loan-approval";

test("a voided loan's chain is read for its history; a rejected loan's is not", () => {
  assert.equal(readsApprovalChain("void"), true);
  assert.equal(readsApprovalChain("rejected"), false);
  for (const status of ["draft", "for_review", "approved", "released", "ongoing", "restructured"]) {
    assert.equal(readsApprovalChain(status), true, status);
  }
  assert.equal(readsApprovalChain(undefined), true);
  // The chain card stays hidden for a voided loan: only the history shows it.
  assert.equal(isApprovalChainHidden("void"), true);
});

test("the loan page's approval hook reads by that rule", () => {
  const hook = readFileSync(join(process.cwd(), "src/hooks/use-loan-approval.ts"), "utf8");
  assert.ok(hook.includes("!readsApprovalChain(status)"));
  assert.ok(!hook.includes("isApprovalChainHidden(status)"));
});
