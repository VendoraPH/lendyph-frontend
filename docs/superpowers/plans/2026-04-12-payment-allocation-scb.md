# Payment Allocation SCB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route payment excess into Share Capital Build-Up before next-amortization rollover on the payments page, and align the share-capital ledger credit with the amount actually allocated.

**Architecture:** Pure-function update to `computeAllocation` in `src/app/(app)/payments/page.tsx`, an added preview card in the allocation-preview section, and a small change in `handleSubmit` so the ledger credit reads from the allocation result instead of a fixed field. No changes outside `payments/page.tsx`; no API changes; no amortization-engine changes.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, Radix UI.

**Testing note (deviation from skill default):** This repo has no unit test framework (no vitest/jest). Project convention per `CLAUDE.md` is typecheck + lint + manual browser verification, plus Playwright e2e for flows. This plan verifies each task with `pnpm typecheck` (or the equivalent) and ends with a dedicated manual-verification task walking through the 5 scenarios from the spec. Do not add a unit-test framework as part of this change.

**Spec:** `docs/superpowers/specs/2026-04-12-payment-allocation-scb-design.md`

---

## File Structure

**Modified:**
- `src/app/(app)/payments/page.tsx` — allocation function, allocation call site, preview UI card, submit-time ledger credit

No files are created. No files are deleted.

---

## Task 1: Add `scbAmount` parameter and SCB step to `computeAllocation`

**Files:**
- Modify: `src/app/(app)/payments/page.tsx:107-147`

- [ ] **Step 1: Read the current `computeAllocation` function**

Read `src/app/(app)/payments/page.tsx` lines 107–147 to confirm the current signature and return shape before editing.

- [ ] **Step 2: Replace the function with the SCB-aware version**

Replace the existing function (lines 107–147) with:

```ts
function computeAllocation(
  amountPaid: number,
  currentDue: number,
  overdueAmount: number,
  penaltyAmount: number,
  interestPortion: number,
  scbAmount: number
) {
  let remaining = amountPaid;

  // 1. Penalty first
  const penaltyApplied = Math.min(remaining, penaltyAmount);
  remaining -= penaltyApplied;

  // 2. Overdue interest (if any arrears)
  const overdueInterest =
    overdueAmount > 0 ? Math.min(remaining, interestPortion) : 0;
  remaining -= overdueInterest;

  // 3. Current period interest
  const currentInterest = Math.min(remaining, interestPortion);
  remaining -= currentInterest;

  // 4. Current period principal
  const currentPrincipalDue = Math.max(0, currentDue - interestPortion - penaltyAmount);
  const currentPrincipal = Math.min(remaining, currentPrincipalDue);
  remaining -= currentPrincipal;

  // 5. Excess → SCB (no cap; drains all remaining excess when loan has SCB)
  const scbApplied = scbAmount > 0 ? remaining : 0;
  remaining -= scbApplied;

  // 6. Excess → next amortization interest (only reachable when scbAmount === 0)
  const nextInterest = remaining > 0 ? Math.min(remaining, interestPortion) : 0;
  remaining -= nextInterest;

  // 7. Excess → next principal
  const nextPrincipal = remaining;

  return {
    penaltyApplied,
    interestApplied: overdueInterest + currentInterest + nextInterest,
    principalApplied: currentPrincipal + nextPrincipal,
    scbApplied,
    nextInterestApplied: nextInterest,
    nextPrincipalApplied: nextPrincipal,
    total: amountPaid,
  };
}
```

Key change vs. current code: new `scbAmount` parameter; new step between current-principal and next-interest; new `scbApplied` field in return value.

- [ ] **Step 3: Run typecheck — expect one or more failures at the call site**

Run: `pnpm typecheck`
Expected: FAIL. The existing `useMemo` at around line 354 calls `computeAllocation(...)` with 5 arguments; after the signature change it is missing `scbAmount`. TypeScript should report "Expected 6 arguments, but got 5" (or similar). This failure is expected and will be fixed in Task 2.

- [ ] **Step 4: Do not commit yet**

The build is intentionally broken between Task 1 and Task 2. Task 2's commit includes both.

---

## Task 2: Pass `scb_amount` at the allocation call site

**Files:**
- Modify: `src/app/(app)/payments/page.tsx:354-364` (the `allocation` `useMemo`)

- [ ] **Step 1: Read the current `useMemo`**

Read the `allocation` `useMemo` in `src/app/(app)/payments/page.tsx` (around line 354). Confirm the current argument order is `(amountPaid, currentDue, overdueAmount, penaltyAmount, interestPortion)`.

- [ ] **Step 2: Add the `scbAmount` argument**

In the `useMemo` body, change the `computeAllocation` call to include `selectedLoan.scb_amount ?? 0` as the sixth argument. The resulting call should look like:

```ts
return computeAllocation(
  amountPaid,
  selectedLoan.current_due,
  selectedLoan.overdue_amount,
  selectedLoan.penalty_amount,
  interestPortion,
  selectedLoan.scb_amount ?? 0
);
```

Leave the `useMemo` dependency array as-is if `selectedLoan` is already a dependency — `scb_amount` is a property of `selectedLoan` and is covered. Confirm this by reading the existing dependency array; if it lists discrete fields instead of `selectedLoan`, add `selectedLoan.scb_amount` to the array.

- [ ] **Step 3: Run typecheck — expect PASS**

Run: `pnpm typecheck`
Expected: PASS. The signature now matches the call site.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: PASS with no new warnings in `src/app/(app)/payments/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/payments/page.tsx
git commit -m "feat(payments): allocate excess to SCB before next amortization"
```

---

## Task 3: Render "Excess → SCB" card in the allocation preview

**Files:**
- Modify: `src/app/(app)/payments/page.tsx:832-866` (the excess-preview cards inside the allocation preview section)

- [ ] **Step 1: Read the current excess-preview block**

Read `src/app/(app)/payments/page.tsx` lines 830–870. Confirm the existing pattern for the `Next Interest` (blue) and `Next Principal` (green) conditional cards inside the `grid gap-3 sm:grid-cols-2` container.

- [ ] **Step 2: Insert the SCB card**

Inside the `<div className="grid gap-3 sm:grid-cols-2">` container, immediately before the `{allocation.nextInterestApplied > 0 && ( ... )}` block, add:

```tsx
{allocation.scbApplied > 0 && (
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-center dark:border-amber-700 dark:bg-amber-900/20">
    <p className="text-[10px] text-muted-foreground mb-1">Excess → SCB</p>
    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
      {formatCurrency(allocation.scbApplied)}
    </p>
  </div>
)}
```

This follows the same structural pattern as the Next Interest (blue) and Next Principal (green) cards and uses amber so it is visually distinct from both. Do not modify the 3-column `Penalty / Interest / Principal` row above it.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/payments/page.tsx
git commit -m "feat(payments): show excess-to-SCB card in allocation preview"
```

---

## Task 4: Use `allocation.scbApplied` for the share-capital ledger credit

**Files:**
- Modify: `src/app/(app)/payments/page.tsx:429-447` (SCB credit block inside `handleSubmit`)

- [ ] **Step 1: Read the current SCB credit block**

Read lines 429–447 of `src/app/(app)/payments/page.tsx`. Confirm the current block credits the fixed `selectedLoan.scb_amount` to the borrower's share capital ledger whenever the loan has any SCB configured.

- [ ] **Step 2: Replace the block so it reads from the allocation**

Replace lines 429–447 with:

```ts
// Credit the portion of this payment that was allocated to SCB
if (allocation && allocation.scbApplied > 0) {
  try {
    await shareCapitalService.ledgerCreate({
      borrower_id: selectedLoan.borrower_id,
      date: paymentDate,
      description: `Share Capital Build-Up from payment — Loan ${selectedLoan.loan_account_number}`,
      type: "credit",
      amount: allocation.scbApplied,
    });
    toast.info("Share Capital credited", {
      description: `${formatCurrency(allocation.scbApplied)} credited to ${selectedLoan.borrower_name}'s share capital.`,
    });
  } catch {
    toast.warning("Payment recorded but share capital credit failed", {
      description: "Please manually credit the share capital entry.",
    });
  }
}
```

Two behavior changes vs. today:
1. Gate is now `allocation && allocation.scbApplied > 0` (was `selectedLoan.scb_amount > 0`). If the user paid only enough to cover penalty/interest/principal, no ledger entry is created.
2. The ledger entry and toast both use `allocation.scbApplied` (was the fixed `selectedLoan.scb_amount`).

- [ ] **Step 3: Verify `allocation` is in scope inside `handleSubmit`**

`allocation` is declared at module-scope inside the component via `useMemo` (around line 354). It is accessible from `handleSubmit`, which is a sibling function declared in the same component body. No extra wiring is needed. If typecheck disagrees in Step 4, re-read the component structure and lift `allocation` or pass it in explicitly — but the expected outcome is a clean pass.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/payments/page.tsx
git commit -m "feat(payments): credit actual SCB allocation to ledger on payment"
```

---

## Task 5: Manual browser verification

**Files:**
- No file changes unless a defect is found.

This task validates the 5 scenarios from the spec against the seeded loans in `src/app/(app)/payments/page.tsx` (the mock loans around lines 198–246).

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: Next.js dev server starts and prints a local URL (typically `http://localhost:3000`). Keep it running.

- [ ] **Step 2: Open the payments page**

In a browser, navigate to `http://localhost:3000/payments` and log in if prompted. Confirm the page renders the loan list without console errors.

- [ ] **Step 3: Scenario A — loan without SCB, exact payment**

Pick a seeded loan whose `scb_amount` is 0 or undefined (most of the mock loans). Click Pay, enter exactly `current_due` as the amount.

Expected: Penalty / Interest / Principal summary row shows sensible values; **no** "Excess → SCB" card is rendered; no Next Interest / Next Principal cards are rendered.

- [ ] **Step 4: Scenario B — loan without SCB, overpayment**

Same loan. Enter `current_due + 1000` as the amount.

Expected: "Excess → Next Interest" (blue) and/or "Excess → Next Principal" (green) cards appear, same as before this change. **No** SCB card.

- [ ] **Step 5: Scenario C — loan with SCB, exact current-period payment**

Pick (or edit a mock to be) a loan with `scb_amount > 0`. Enter exactly `current_due` as the amount.

Expected: `allocation.scbApplied` is 0, no SCB card rendered, no Next Interest / Next Principal cards. On submit, **no** share capital credit toast appears, and no ledger entry is created (check the borrower's share capital page or the toast stack — the `shareCapitalService.ledgerCreate` call should not have run).

- [ ] **Step 6: Scenario D — loan with SCB, overpayment**

Same SCB-enabled loan. Enter `current_due + 2500` as the amount.

Expected: The "Excess → SCB" (amber) card shows `₱2,500.00` (or whatever the overage is). The Next Interest and Next Principal cards do **not** appear — all excess drained into SCB. On submit, a "Share Capital credited" toast shows the same amount, and the ledger entry reflects it.

- [ ] **Step 7: Scenario E — loan with SCB + arrears + penalty**

Pick (or edit a mock to be) a loan with `scb_amount > 0`, `overdue_amount > 0`, and `penalty_amount > 0`. Enter an amount that fully covers penalty + overdue + current + some leftover.

Expected: Penalty, overdue interest, current interest, and current principal are filled first (visible in the 3-column summary). The remainder appears in the SCB card. Ledger credit on submit equals the SCB card amount.

- [ ] **Step 8: Check console + typecheck + lint one more time**

Confirm no browser console errors across scenarios A–E. Then run:

```
pnpm typecheck
pnpm lint
```

Expected: both PASS.

- [ ] **Step 9: If any scenario failed, fix and commit the fix**

If a scenario revealed a defect, fix it in `src/app/(app)/payments/page.tsx`, re-run the failing scenario, re-run typecheck + lint, and commit with a message describing the fix. If everything passed, no commit is needed for this task.

- [ ] **Step 10: Stop the dev server**

Kill the `pnpm dev` process.

---

## Self-Review Checklist (for the plan author)

- [x] Every spec requirement maps to a task: allocation order change → Task 1; call-site wiring → Task 2; preview card → Task 3; ledger credit alignment → Task 4; 5 test scenarios → Task 5.
- [x] No "TODO", "TBD", "add validation", or bare test stubs.
- [x] `scbApplied` is defined in Task 1 and used identically in Tasks 3 and 4. No name drift.
- [x] `allocation` is referenced from `handleSubmit` in Task 4; Step 3 explicitly instructs the implementer to verify scope before proceeding.
- [x] TDD deviation is flagged at the top of the plan with the reason.
