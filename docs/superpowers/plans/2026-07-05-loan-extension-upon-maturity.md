# Loan Extension Interest-Gate + Adjustment History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two gaps found in the existing (already-implemented) Loan Extension feature for Upon Maturity loans: (1) the standalone "Extend Loan" dialog must collect the interest due before extending, (2) the partial-payment auto-extend prompt must pay before extending, and (3) render the adjustment/extension audit trail that is fetched but never shown.

**Architecture:** All changes are frontend-only, confined to `src/app/(app)/loans/[id]/page.tsx` (state, handlers, dialog JSX, new card) plus two small shared-type/constant additions (`src/types/loan-adjustment.ts`, `src/constants/index.ts`). No backend/API changes — `POST /loans/{id}/extend` already carries unpaid interest into the new period, so paying it down to zero via the existing `POST /loans/{loan}/repayments` endpoint before calling extend is sufficient.

**Tech Stack:** Next.js app router, React (hooks), TypeScript, existing `repaymentService` / `loanService` / `loanAdjustmentService` clients, shadcn-style UI primitives (`Dialog`, `AlertDialog`, `Card`, `Badge`, `Popover`+`Calendar`).

## Global Constraints

- No backend/API changes (per approved design spec, `docs/superpowers/specs/2026-07-05-loan-extension-upon-maturity-design.md`).
- Extension duration/eligibility logic (one month, upon-maturity only, unlimited consecutive extensions) is unchanged — it already lives in the backend `/extend` endpoint.
- No changes to the Auto Pay (full payoff) flow.
- No changes to the manual "New Adjustment" creation dialog's fields — only wire its already-built approve/reject/apply actions and render its output.
- No test suite currently covers `loans/[id]/page.tsx` (confirmed: `e2e/` has no loan-detail spec) — verification is manual against a running dev server, plus `npm run lint` / `tsc --noEmit`.
- Follow existing patterns in the file exactly: the `formatCurrency`/`formatDate`/`formatDateObj`/`formatDateISO` helpers are defined locally at the top of this file (lines 136–167), not imported from `@/lib/format` — do not add a second import.

---

## File Structure

- Modify `src/types/loan-adjustment.ts` — add `"extension"` to the `LoanAdjustmentType` union.
- Modify `src/constants/index.ts` — add `ADJUSTMENT_TYPE_LABELS` map (mirrors existing `LOAN_STATUS_LABELS` pattern).
- Modify `src/app/(app)/loans/[id]/page.tsx`:
  - Add `adjustmentStatusColors` map (mirrors existing `statusColors` at line 296).
  - Add two new state vars for the Extend dialog's payment date picker.
  - Rewrite `submitRepayment` to return a `boolean` success flag (backward compatible — existing callers ignore the return value).
  - Rewrite `handleExtendLoan` to pay interest-due first, then extend.
  - Rewrite `handlePartialExtendConfirm` to pay first (via `submitRepayment`), then extend.
  - Redesign the "Extend Loan" `AlertDialog` JSX to show interest due + a payment date picker.
  - Add a new "Adjustments" `Card` after the Ledger card, rendering `adjustments` with status/type badges and wiring `handleAdjustmentAction`.

---

## Task 1: Add `"extension"` adjustment type + labels

**Files:**
- Modify: `src/types/loan-adjustment.ts:1-5`
- Modify: `src/constants/index.ts` (insert after `LOAN_STATUS_LABELS`, i.e. after line 33)

**Interfaces:**
- Produces: `LoanAdjustmentType` now includes `"extension"`; `ADJUSTMENT_TYPE_LABELS: Record<string, string>` exported from `@/constants`, consumed by Task 4.

- [ ] **Step 1: Add `"extension"` to the union**

Edit `src/types/loan-adjustment.ts`:

```ts
export type LoanAdjustmentType =
  | "restructure"
  | "penalty_waiver"
  | "balance_adjustment"
  | "term_extension"
  | "extension";
```

- [ ] **Step 2: Add `ADJUSTMENT_TYPE_LABELS` to constants**

Edit `src/constants/index.ts`, insert immediately after the closing `};` of `LOAN_STATUS_LABELS` (line 33):

```ts
export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  extension: "Extension",
  restructure: "Restructure",
  penalty_waiver: "Penalty Waiver",
  balance_adjustment: "Balance Adjustment",
  term_extension: "Term Extension",
};

export const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  applied: "Applied",
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this change (pre-existing errors, if any, are unrelated and out of scope).

- [ ] **Step 4: Commit**

```bash
git add src/types/loan-adjustment.ts src/constants/index.ts
git commit -m "feat(loans): add extension adjustment type and label maps"
```

---

## Task 2: Make `submitRepayment` report success/failure

**Files:**
- Modify: `src/app/(app)/loans/[id]/page.tsx:2016-2047`

**Interfaces:**
- Consumes: `repaymentService.create(loanId, data)` (existing, unchanged signature).
- Produces: `submitRepayment(data): Promise<boolean>` — `true` on a successful post (dialog closed, refreshes kicked off), `false` if `repaymentService.create` threw. Task 3's `handlePartialExtendConfirm` depends on this return value to decide whether to call `extend`.

- [ ] **Step 1: Change `submitRepayment` to return a boolean**

Replace lines 2016-2047:

```ts
  const submitRepayment = async (data: {
    payment_date: string;
    amount_paid: number;
    remarks?: string;
  }): Promise<boolean> => {
    setActionLoading(true);
    try {
      const repayment = await repaymentService.create(loan.id, data);
      toast.success(
        paymentMode === "advance" ? "Advance payment recorded" : "Payment recorded",
        { action: { label: "View Receipt", onClick: () => router.push(`/payments/${repayment.id}`) } }
      );
      setRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentDate(new Date());
      setPaymentPreview(null);
      setPaymentMode("regular");
      setAdvancePeriods(1);
      // Refresh independently — don't let any single failure block the others
      // or pollute the catch block (payment already succeeded at this point).
      const loanId = loan.id;
      fetchSchedule(loanId);
      fetchLoanSummary(loanId);
      fetchRepayments(loanId);
      loanService.detail(loanId).then(setLoan).catch(() => {});
      return true;
    } catch {
      toast.error("Failed to record payment");
      return false;
    } finally {
      setActionLoading(false);
    }
  };
```

This is the only change in this task: the function body is identical except the two new `return` statements and the `Promise<boolean>` return type. The existing call site at `handleRecordPayment` (`await submitRepayment(payload);`) ignores the return value and keeps compiling and behaving exactly as before.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/loans/[id]/page.tsx"
git commit -m "refactor(loans): submitRepayment reports success so callers can chain on it"
```

---

## Task 3: Pay-then-extend for the partial-payment auto-extend prompt (Gap 2)

**Files:**
- Modify: `src/app/(app)/loans/[id]/page.tsx:2159-2186`

**Interfaces:**
- Consumes: `submitRepayment(data): Promise<boolean>` (Task 2), `loanService.extend(id, { remarks })`, `extendErrorMessage(err)` (existing, line 2092), `loanService.detail`, `fetchSchedule`, `fetchLoanSummary`.
- Produces: no new exports — internal handler only, wired to the existing `partialExtendOpen` `AlertDialog`'s `AlertDialogAction onClick`.

- [ ] **Step 1: Replace `handlePartialExtendConfirm`**

Replace lines 2159-2186:

```ts
  const handlePartialExtendConfirm = async () => {
    if (!pendingPayment) return;
    const payload = pendingPayment;
    setPartialExtendOpen(false);
    setPendingPayment(null);
    // Pay first — this posts the cashier's originally-entered amount against
    // the CURRENT period (before it rolls over), then extend. Reversing this
    // order (as the old code did) posted the payment against the already-
    // extended period instead of paying down the period it was meant to settle.
    const paid = await submitRepayment(payload);
    if (!paid) return;
    setActionLoading(true);
    try {
      await loanService.extend(loan.id, {
        remarks: `Auto-extend on partial payment of ${payload.amount_paid}`,
      });
      toast.success("Loan extended");
      const updated = await loanService.detail(loan.id);
      setLoan(updated);
      fetchSchedule(loan.id);
      fetchLoanSummary(loan.id);
    } catch (err) {
      toast.error(extendErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };
```

- [ ] **Step 2: Manual verification**

Run the dev server (`npm run dev`), open an upon-maturity loan in `released`/`current` status with an outstanding balance, click "Record Payment", enter an amount less than the full amount due, submit. Confirm:
1. The "Extend loan?" prompt appears (unchanged trigger logic in `handleRecordPayment`, line 2073-2080).
2. Clicking "Yes, extend" records the payment first (visible in the Ledger immediately) and only then extends the loan (maturity date and schedule update after).
3. If you simulate an extend failure (e.g. temporarily point `loan.status` away from an extendable status), the payment is still recorded and visible — only the extend toast errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/loans/[id]/page.tsx"
git commit -m "fix(loans): pay before extending on partial-payment auto-extend prompt"
```

---

## Task 4: Interest-gated "Extend Loan" dialog (Gap 1)

**Files:**
- Modify: `src/app/(app)/loans/[id]/page.tsx:847-850` (state)
- Modify: `src/app/(app)/loans/[id]/page.tsx:2136-2157` (`handleExtendLoan`)
- Modify: `src/app/(app)/loans/[id]/page.tsx:5171-5218` (Extend Loan `AlertDialog` JSX)

**Interfaces:**
- Consumes: `storedSchedule` (existing memo, line 1234), `repaymentService.create`, `loanService.extend`, `extendErrorMessage` (existing).
- Produces: no new exports — internal state/handler/JSX only.

- [ ] **Step 1: Add extend-dialog payment date state**

Immediately after line 850 (`const [pendingPayment, setPendingPayment] = useState<{ ... }>` block — find the closing of that `useState` call, which sits right before the `adjustments` state block at line 857), add:

```ts
  const [extendPaymentDate, setExtendPaymentDate] = useState<Date>(new Date());
  const [extendPaymentDatePickerOpen, setExtendPaymentDatePickerOpen] = useState(false);
```

- [ ] **Step 2: Rewrite `handleExtendLoan`**

Replace lines 2136-2157:

```ts
  const handleExtendLoan = async () => {
    const currentDue = storedSchedule.find((row) => row.status !== "paid");
    const interestDue = currentDue?.interest ?? 0;
    setActionLoading(true);
    // Pay the interest due for the current period first — extending
    // without collecting it would let staff defer the loan indefinitely.
    if (interestDue > 0) {
      try {
        await repaymentService.create(loan.id, {
          payment_date: formatDateISO(extendPaymentDate),
          amount_paid: interestDue,
          remarks: extendRemarks.trim() || "[EXTENSION INTEREST]",
        });
      } catch {
        toast.error("Failed to record the interest payment. Extension was not processed.");
        setActionLoading(false);
        return;
      }
    }
    try {
      await loanService.extend(loan.id, {
        remarks: extendRemarks.trim() || undefined,
      });
      toast.success("Loan extended by one cycle");
      setExtendOpen(false);
      setExtendRemarks("");
      setExtendPaymentDate(new Date());
    } catch (err) {
      // Interest (if any) is already paid at this point — leave the dialog
      // open so the user can see the error and retry; a retry will see
      // interestDue recomputed as 0 and skip straight to extend().
      toast.error(extendErrorMessage(err));
    } finally {
      try {
        const updated = await loanService.detail(loan.id);
        setLoan(updated);
        await fetchSchedule(loan.id);
        await fetchLoanSummary(loan.id);
        await fetchRepayments(loan.id);
      } catch {
        // non-fatal — dialog state above already reflects the outcome
      }
      setActionLoading(false);
    }
  };
```

- [ ] **Step 3: Redesign the Extend Loan dialog JSX**

Replace lines 5171-5218:

```tsx
      {/* Extend Loan Dialog (Upon Maturity — Process 1: manual extension) */}
      <AlertDialog open={extendOpen} onOpenChange={setExtendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-muted-foreground" />
              Extend Loan
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move the loan&apos;s due date forward by one cycle.
              The principal and any remaining balance are unchanged. The
              interest due below will be collected as a payment before the
              loan extends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const currentDue = storedSchedule.find((row) => row.status !== "paid");
            const interestDue = currentDue?.interest ?? 0;
            return (
              <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/30">
                <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wide font-semibold">
                  Interest Due — must be paid to extend
                </p>
                <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                  {formatCurrency(interestDue)}
                </p>
              </div>
            );
          })()}
          <div className="space-y-2">
            <Label className="text-xs">Payment Date</Label>
            <Popover open={extendPaymentDatePickerOpen} onOpenChange={setExtendPaymentDatePickerOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span>{formatDateObj(extendPaymentDate)}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={extendPaymentDate}
                  onSelect={(date) => {
                    if (date) setExtendPaymentDate(date);
                    setExtendPaymentDatePickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extend-remarks" className="text-xs">
              Remarks (optional)
            </Label>
            <Textarea
              id="extend-remarks"
              value={extendRemarks}
              onChange={(e) => setExtendRemarks(e.target.value)}
              placeholder="e.g. borrower requested extension"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExtendLoan}
              disabled={actionLoading}
              className="bg-brand-blue text-brand-blue-foreground shadow-sm hover:bg-brand-blue-dark hover:shadow-md transition-all"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extending...
                </>
              ) : (
                <>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Confirm Extension
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 4: Manual verification**

Run the dev server, open an upon-maturity loan with an outstanding balance and accrued interest, click "Extend Loan". Confirm:
1. Dialog shows "Interest Due" read-only amount matching the Amortization Schedule's current row interest.
2. Confirming records a payment (visible in Ledger with remarks or `[EXTENSION INTEREST]`) and then extends the loan — maturity date moves forward one month, new schedule row appears.
3. Extend a second time on the same loan (unlimited consecutive extensions) — confirm it works again with a freshly computed interest-due amount.
4. If interest due is already 0 (e.g. immediately after a successful extension with no time elapsed), confirming skips the payment call and extends directly (check network tab — no `/repayments` POST fired).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/loans/[id]/page.tsx"
git commit -m "feat(loans): require interest payment before extending an upon-maturity loan"
```

---

## Task 5: Adjustment/Extension History card (Gap 3)

**Files:**
- Modify: `src/app/(app)/loans/[id]/page.tsx:127-131` (import `ADJUSTMENT_TYPE_LABELS`, `ADJUSTMENT_STATUS_LABELS`)
- Modify: `src/app/(app)/loans/[id]/page.tsx:296-307` (add `adjustmentStatusColors` map next to `statusColors`)
- Modify: `src/app/(app)/loans/[id]/page.tsx:3858-3860` (insert new Card between the Ledger card's closing `)}` and the `{/* ── Dialogs ── */}` comment)

**Interfaces:**
- Consumes: `adjustments: LoanAdjustment[]` (existing state, line 857), `adjustmentsLoading: boolean` (existing state, line 858), `handleAdjustmentAction(adjId: number, action: "approve" | "reject" | "apply")` (existing, line 2296 — currently dead code), `ADJUSTMENT_TYPE_LABELS` / `ADJUSTMENT_STATUS_LABELS` (Task 1), `formatDate` (local helper).
- Produces: no new exports — this is the terminal rendering task.

- [ ] **Step 1: Import the new label maps**

Edit the `@/constants` import block (lines 127-131):

```ts
import {
  LOAN_STATUS_LABELS,
  PAYMENT_FREQUENCY_LABELS,
  PAYMENT_FREQUENCY_OPTIONS,
  ADJUSTMENT_TYPE_LABELS,
  ADJUSTMENT_STATUS_LABELS,
} from "@/constants";
```

- [ ] **Step 2: Add `adjustmentStatusColors`**

Immediately after the closing `};` of `statusColors` (line 307), add:

```ts
const adjustmentStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  applied: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
};
```

- [ ] **Step 3: Insert the Adjustments card**

Insert immediately after line 3858 (the `)}` that closes the Ledger card's `{isLocked && ( ... )}` block) and before line 3860's `{/* ── Dialogs ── */}` comment:

```tsx

      {/* Adjustments & Extension History — only for released+ loans */}
      {isLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Adjustments &amp; History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {adjustmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : adjustments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No adjustments recorded for this loan yet.
              </p>
            ) : (
              <div className="divide-y">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ADJUSTMENT_TYPE_LABELS[adj.adjustment_type] ?? adj.adjustment_type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", adjustmentStatusColors[adj.status])}
                        >
                          {ADJUSTMENT_STATUS_LABELS[adj.status] ?? adj.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(adj.created_at)}
                        </span>
                      </div>
                      {(adj.description || adj.remarks) && (
                        <p className="mt-1 text-sm text-muted-foreground truncate">
                          {adj.description || adj.remarks}
                        </p>
                      )}
                    </div>
                    {adj.adjustment_type !== "extension" && adj.status === "pending" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading}
                          onClick={() => handleAdjustmentAction(adj.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={actionLoading}
                          onClick={() => handleAdjustmentAction(adj.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {adj.adjustment_type !== "extension" && adj.status === "approved" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue-dark"
                          disabled={actionLoading}
                          onClick={() => handleAdjustmentAction(adj.id, "apply")}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 4: Manual verification**

Run the dev server. On an upon-maturity loan that has been extended at least once (from Task 4's verification), confirm:
1. The "Adjustments & History" card appears below the Ledger card.
2. Each extension shows an "Extension" badge with an "Applied" status badge, no action buttons, and its `created_at` date.
3. Click "New Adjustment", create a `balance_adjustment` (or any type) — confirm it appears in the new card with a "Pending" badge and Approve/Reject buttons.
4. Click "Approve" — confirm `handleAdjustmentAction` fires (prompt for remarks), the row updates to "Approved" with an "Apply" button, and clicking "Apply" moves it to "Applied" with the loan detail refreshing.
5. Confirm the empty state ("No adjustments recorded for this loan yet.") renders for a loan with no adjustments.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/loans/[id]/page.tsx"
git commit -m "feat(loans): render adjustment/extension history and wire approve/reject/apply"
```

---

## Task 6: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no new errors/warnings in `src/app/(app)/loans/[id]/page.tsx`, `src/types/loan-adjustment.ts`, `src/constants/index.ts`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: End-to-end manual walkthrough**

Run the dev server and, on a single upon-maturity loan, walk the full lifecycle: release → extend via "Extend Loan" (interest collected) → record a partial payment to trigger the auto-extend prompt (payment recorded before extend) → verify Adjustments & History card shows both extensions plus the partial-payment-triggered one → verify Auto Pay (full payoff) still closes the loan normally (unchanged flow, regression check only).

- [ ] **Step 4: Commit (only if fixes were needed)**

If lint/typecheck turned up anything, fix and commit as a follow-up commit; otherwise this task produces no commit.

---

## Self-Review

**1. Spec coverage:**
- Gap 1 (interest-gated Extend dialog) → Task 4. ✓
- Gap 2 (pay-then-extend reorder) → Task 3 (depends on Task 2's `submitRepayment` boolean return). ✓
- Gap 3 (adjustment/extension history + wiring dead `handleAdjustmentAction`) → Task 1 (types/labels) + Task 5 (rendering). ✓
- "No backend changes" — confirmed, no task touches `src/services/*` request shapes or adds endpoints. ✓
- "Unlimited consecutive extensions" — unchanged, still delegated to backend; Task 4's manual verification step 3 explicitly re-tests a second consecutive extension. ✓

**2. Placeholder scan:** No TBD/TODO markers; every step has literal code. Manual-verification steps are used instead of automated tests because no test harness exists for this page (confirmed via `Glob e2e/**/*loan*` → no matches) and the spec's own testing plan calls for manual verification.

**3. Type consistency:**
- `submitRepayment` return type `Promise<boolean>` (Task 2) is consumed correctly in Task 3 (`const paid = await submitRepayment(payload); if (!paid) return;`).
- `LoanAdjustmentType` gains `"extension"` (Task 1) before Task 5 references `adj.adjustment_type !== "extension"` and `ADJUSTMENT_TYPE_LABELS[adj.adjustment_type]` — both type-check against the updated union.
- `ADJUSTMENT_TYPE_LABELS` / `ADJUSTMENT_STATUS_LABELS` (Task 1) are imported and consumed with matching names in Task 5 — no naming drift.
- `extendPaymentDate` / `extendPaymentDatePickerOpen` (Task 4, Step 1) are declared before their first use in Task 4 Step 2 (`handleExtendLoan`) and Step 3 (JSX) — ordering is correct since Step 1 is applied first.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-loan-extension-upon-maturity.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
