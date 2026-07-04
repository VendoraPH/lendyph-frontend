# Normal Loan Approval Chain Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the default normal loan approval chain so the BOD Chairwoman acts as confirmation (approve) and the Cashier performs the release, matching the intended 4-step flow.

**Architecture:** Single-constant edit in `src/services/approval-workflow.service.ts`. The chain validator (same file) already accepts the new shape without modification. No other files are affected.

**Tech Stack:** Next.js 15 App Router, TypeScript. No test framework in this repo — verification is typecheck + lint + manual browser walkthrough per project convention (`CLAUDE.md`).

**Spec:** `docs/superpowers/specs/2026-04-12-loan-workflow-normal-chain-fix-design.md`

---

## File Structure

**Modified:**
- `src/services/approval-workflow.service.ts` — `DEFAULT_NORMAL_CHAIN` constant and the comment directly above it.

No files created. No files deleted.

---

## Task 1: Update `DEFAULT_NORMAL_CHAIN` to the 4-step flow

**Files:**
- Modify: `src/services/approval-workflow.service.ts:36-41`

- [ ] **Step 1: Read the current `DEFAULT_NORMAL_CHAIN` block**

Read `src/services/approval-workflow.service.ts` lines 30–45 to confirm the current shape of the constant and the comment above it. You should see a 3-step chain ending with a `chairwoman` step whose `kind` is `"release"`.

- [ ] **Step 2: Replace the constant and update the comment**

Replace the block that currently reads:

```ts
// Normal loan flow — Manager approval, Chairwoman confirmation only
const DEFAULT_NORMAL_CHAIN: ApprovalChainStep[] = [
  { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
  { id: "manager", name: "Manager", role: "manager", kind: "approve" },
  { id: "chairwoman", name: "BOD Chairwoman", role: "bod1", kind: "release" },
];
```

with:

```ts
// Normal loan flow — Manager approval, Chairwoman confirmation, Cashier release
const DEFAULT_NORMAL_CHAIN: ApprovalChainStep[] = [
  { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
  { id: "manager", name: "Manager", role: "manager", kind: "approve" },
  { id: "chairwoman", name: "BOD Chairwoman", role: "bod1", kind: "approve" },
  { id: "cashier", name: "Cashier", role: "cashier", kind: "release" },
];
```

Two differences from the original:
1. The `chairwoman` step's `kind` changes from `"release"` to `"approve"`.
2. A new `cashier` step is appended with `kind: "release"`.
3. The header comment is updated to reflect the 4-step flow.

Do not touch the `DEFAULT_CHAIN` constant above (policy-exception chain) or any function in this file. The `validateChain` function will accept the new shape without modification because `loan-processor` is still first-and-submit, `cashier` is last-and-release, and all four `id`s are unique.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`

(If `bun` is unavailable, use `pnpm typecheck` or `npx tsc --noEmit`. The repo has both `bun` and `npm` available; `pnpm` may not be installed. You can confirm by running `which bun pnpm npm`.)

Expected: PASS, no output.

- [ ] **Step 4: Run lint**

Run: `bun run lint`

Expected: PASS, no new warnings in `src/services/approval-workflow.service.ts`. Pre-existing warnings in unrelated files are fine and should be ignored.

- [ ] **Step 5: Commit**

```bash
git add src/services/approval-workflow.service.ts
git commit -m "fix(approval-workflow): chairwoman confirms, cashier releases in normal chain"
```

---

## Task 2: Manual browser verification

**Files:**
- No file changes unless a defect is found.

This task validates the 3 testing scenarios from the spec.

- [ ] **Step 1: Confirm the dev server is running**

If the user already has a dev server on `http://localhost:3000`, use it. Otherwise start one with `bun run dev` in the background. Wait for the "Ready" line.

- [ ] **Step 2: Scenario 1 — fresh state**

In the browser devtools console on any page of the app, run:

```js
localStorage.removeItem("approval-workflow-config-normal");
```

Then navigate to `/settings/approval-workflow`, switch to the "Normal" tab.

Expected: Exactly 4 steps rendered in order.
1. Loan Processor — submit
2. Manager — approve
3. BOD Chairwoman — approve
4. Cashier — release

- [ ] **Step 3: Scenario 2 — regression check**

In the console, inject a fake saved normal chain:

```js
localStorage.setItem(
  "approval-workflow-config-normal",
  JSON.stringify([
    { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
    { id: "manager", name: "Manager", role: "manager", kind: "approve" },
    { id: "chairwoman", name: "BOD Chairwoman", role: "bod1", kind: "release" },
  ])
);
```

Reload `/settings/approval-workflow`, switch to the "Normal" tab.

Expected: The 3-step saved chain is rendered as-is. The new default is **not** shown because a saved value exists.

- [ ] **Step 4: Scenario 3 — reset**

Still on the "Normal" tab with the 3-step saved chain from Scenario 2 visible, click the Reset button on that tab.

Expected: The tab now renders the new 4-step default (Loan Processor → Manager → BOD Chairwoman → Cashier). After the reset, running `localStorage.getItem("approval-workflow-config-normal")` in the console returns `null` (the reset method calls `removeItem`).

- [ ] **Step 5: Check the browser console for errors**

Expected: No new console errors produced by scenarios 1–3.

- [ ] **Step 6: Run typecheck + lint one more time**

```
bun run typecheck
bun run lint
```

Expected: both PASS.

- [ ] **Step 7: If any scenario failed, fix and commit the fix**

If a scenario revealed a defect, fix it in `src/services/approval-workflow.service.ts` (or the settings page if truly necessary), re-run the failing scenario, re-run typecheck + lint, and commit with a message describing the fix. If everything passed, no commit is needed for this task.

---

## Self-Review Checklist (for the plan author)

- [x] Spec coverage: every section of the spec maps to a task. Change block → Task 1 Step 2. Validator-still-passes → Task 1 Step 2 note. Testing scenarios 1/2/3 → Task 2 Steps 2/3/4. Typecheck → Task 1 Step 3 and Task 2 Step 6. Out-of-scope items stay untouched because Task 1 explicitly only modifies the one constant.
- [x] No "TODO" / "TBD" / vague steps. All code shown in full.
- [x] Type consistency: every step references the same `DEFAULT_NORMAL_CHAIN`, `ApprovalChainStep`, and `approval-workflow-config-normal` localStorage key used by the spec and the existing code.
- [x] Runner commands match what the repo actually supports. `bun` is confirmed available; `pnpm` is not installed; fallback to `npx tsc --noEmit` is documented.
