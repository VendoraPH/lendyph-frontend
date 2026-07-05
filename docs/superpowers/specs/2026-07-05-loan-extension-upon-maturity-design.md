# Loan Extension Feature for One-Time Payment (Upon Maturity) Loans — Design

## Status: existing feature, gap-fix (not a green-field build)

Investigation before design confirmed the feature already exists end-to-end:

- Backend: `POST /api/loans/{id}/extend` — "Extend an upon-maturity loan by one
  cycle. Rolls the maturity date forward by one frequency cycle. Carries
  unpaid principal and unpaid interest into a new period and accrues fresh
  interest using the loan's existing rate. Records a directly-applied
  LoanAdjustment row of type 'extension'."
- Frontend (`src/app/(app)/loans/[id]/page.tsx`): `loanService.extend()`, an
  "Extend Loan" button gated to upon-maturity loans with an outstanding
  balance, an extend confirmation dialog, an auto-prompt when a cashier
  records a partial payment on an upon-maturity loan, and an "Auto Pay"
  button to close the loan by paying the full balance.

This matches the spec's core mechanics: upon-maturity only, fixed one-month
extension per cycle, unlimited consecutive extensions, principal unchanged,
new maturity date, new schedule generated.

Two gaps were found and are the subject of this design. No backend changes
are required — `/loans/{id}/extend` already carries "unpaid interest" into
the new period, so paying the interest down to zero before calling it is
sufficient to make an extension carry no interest forward.

## Gap 1 — Standalone "Extend Loan" button doesn't collect the interest payment

Today the dialog says outright "no payment is recorded" and calls
`loanService.extend()` with only optional remarks. This lets staff defer an
upon-maturity loan indefinitely without ever collecting the interest due,
which conflicts with the required rule: the borrower must pay the interest
due for the current period to extend.

### Fix

- Compute **interest due for the current period** from existing schedule
  data: `storedSchedule`'s first non-paid row's `interest` field (already
  computed for upon-maturity loans as the accrued interest to date).
- Extend dialog shows this amount read-only ("Interest Due: ₱X — must be paid
  to extend"), plus a payment date field (defaults to today, reusing the
  existing date-picker pattern from Record Payment) and the existing remarks
  field.
- On confirm, **two sequential calls**:
  1. `repaymentService.create(loan.id, { payment_date, amount_paid: interestDue, remarks })`
  2. On success, `loanService.extend(loan.id, { remarks })`
- If step 1 fails: show error, nothing else happens (current behavior for
  failed payments).
- If step 1 succeeds but step 2 fails: refresh loan/schedule/summary, show an
  error toast, and leave the dialog open/re-clickable. Since the interest is
  now paid, a retry of "Extend Loan" will succeed with zero carried interest
  — no manual cleanup needed.
- Button remains gated the same way (upon-maturity, status in
  released/ongoing/current/past_due, outstanding balance > 0).

## Gap 2 — Partial-payment auto-extend prompt extends before paying

The existing flow (cashier enters a payment less than the full amount due →
prompted "extend loan?") currently calls `extend()` **first**, then posts the
originally-entered payment against the now-extended loan. This means the
payment lands against the new period instead of paying down the current
period's interest, which can leave the new period under-covered depending on
how the backend re-accrues interest after extension.

### Fix

Reorder to **pay → extend**, matching Gap 1's fix and the spec's intent:

1. `repaymentService.create(loan.id, payload)` (the payload the cashier
   already entered — unchanged amount/date/remarks)
2. On success, `loanService.extend(loan.id, { remarks: "Auto-extend on partial payment of ..." })`
3. Refresh loan/schedule/summary either way; if extend fails, show error but
   leave the already-recorded payment in place (it's a valid partial
   payment either way).

This changes `handlePartialExtendConfirm`'s call order and simplifies it —
no more "extend now, refresh, then submit the pending payload" dance.

## Gap 3 — No extension/adjustment history is ever shown

`adjustments` (fetched via `fetchAdjustments`, includes every extension as a
`LoanAdjustment` row with `adjustment_type: "extension"`) is stored in state
but never rendered anywhere in the page. Additionally, `handleAdjustmentAction`
(approve/reject/apply for manually-created adjustments like restructure,
penalty_waiver, balance_adjustment, term_extension) is fully implemented but
never wired to any button — it's dead code today.

### Fix

Add an **Adjustments** card (placed next to the existing Ledger card, visible
under the same `isLocked` condition) listing all adjustments for the loan:

- Each row: type badge (Extension / Restructure / Penalty Waiver / Balance
  Adjustment / Term Extension — needs a label map, mirroring
  `LOAN_STATUS_LABELS`), description/remarks, status badge (pending / approved
  / rejected / applied), created date.
- `extension`-typed rows (backend auto-applies these, status is already
  `applied`) render as plain history — no action buttons.
- Pending rows created via the existing "New Adjustment" dialog show
  Approve / Reject / Apply buttons wired to the existing
  `handleAdjustmentAction`.
- Empty state: "No adjustments recorded for this loan yet."
- Loading state uses the existing `adjustmentsLoading` flag (already
  tracked, just unused for rendering today).

`LoanAdjustmentType` (`src/types/loan-adjustment.ts`) will need an `"extension"`
member added to the union so the fetched rows type-check and can be labeled.

## Out of scope

- No backend/API changes.
- No changes to the Auto Pay (full payoff) flow.
- No changes to the manual "New Adjustment" creation dialog beyond the new
  list rendering + wiring already-built handlers.
- No global (cross-loan) adjustments/audit view — scoped to the single loan
  detail page.

## Testing plan

- Manual verification against a running dev server: upon-maturity loan,
  attempt "Extend Loan" → confirm interest payment is required and recorded,
  loan extends, maturity date and schedule update.
- Manual verification of the partial-payment prompt with the new pay-then-
  extend order.
- Manual verification that adjustment history renders for a loan with prior
  extensions, and that approve/reject/apply works for a manually created
  pending adjustment.
- Existing lint/typecheck (`npm run lint`, `tsc --noEmit` if configured) must
  pass — no test suite currently covers this page beyond Playwright e2e
  (check `e2e/` for any loan-detail coverage to update if present).
