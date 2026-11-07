import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const loanPage = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

test('the loan page never says "for review" (for_review stays the stored value)', () => {
  assert.deepEqual(loanPage.match(/.*for review.*/gi) ?? [], []);
});

test("the loan page says Submit for Approval, and Workflow History says Submitted for approval", () => {
  assert.ok(loanPage.includes("Submit for Approval"));
  const workflowHistory = readFileSync(
    join(process.cwd(), "src/app/(app)/loans/[id]/_lib/workflow-history.ts"),
    "utf8",
  );
  assert.ok(workflowHistory.includes('label: "Submitted for approval"'));
  assert.ok(loanPage.includes("workflowEvents(loan)"));
});
