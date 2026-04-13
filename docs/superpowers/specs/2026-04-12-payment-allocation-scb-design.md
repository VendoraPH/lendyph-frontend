# Payment Allocation: SCB Step

**Date:** 2026-04-12
**Scope:** `src/app/(app)/payments/page.tsx`

## Problem

The payment page allocates a paid amount across penalty, interest, and principal in a fixed order, then sends any excess to the next amortization period. Share Capital Build-Up (SCB) is never part of this allocation — `handleSubmit` separately credits the loan's fixed `scb_amount` to the borrower's share capital ledger on every payment, regardless of how much was actually paid. There is no link between what the preview shows and what the ledger records.

## Goal

Extend the allocation order to route excess into SCB when the loan has SCB, and make the ledger credit reflect the actual amount allocated.

## New Allocation Order

When `selectedLoan.scb_amount > 0`:

1. Penalty
2. Overdue interest (if arrears)
3. Current period interest
4. Current period principal
5. **Excess → SCB (no cap — drains all remaining excess)**
6. Excess → next amortization interest
7. Excess → next principal

When `scb_amount` is falsy, step 5 is skipped and behavior is identical to today.

**No-cap consequence (confirmed intentional):** On a loan with SCB, every peso of overpayment beyond the current period becomes share capital. Borrowers cannot pre-pay future amortization while SCB is active — steps 6 and 7 are only reachable when SCB is absent.

## Changes

### `computeAllocation` (src/app/(app)/payments/page.tsx:107)

Add `scbAmount: number` parameter. Insert SCB step between current-principal and next-interest:

```ts
// 5. Excess → SCB (no cap when scbAmount > 0)
const scbApplied = scbAmount > 0 ? remaining : 0;
remaining -= scbApplied;

// 6. Excess → next amortization interest (only if no SCB)
const nextInterest = remaining > 0 ? Math.min(remaining, interestPortion) : 0;
remaining -= nextInterest;

// 7. Excess → next principal
const nextPrincipal = remaining;
```

Return value gains one field:

```ts
{
  penaltyApplied,
  interestApplied,   // overdueInterest + currentInterest + nextInterest
  principalApplied,  // currentPrincipal + nextPrincipal
  scbApplied,        // NEW
  nextInterestApplied,
  nextPrincipalApplied,
  total,
}
```

The `useMemo` at line 354 passes `selectedLoan.scb_amount ?? 0` as the new argument.

### Allocation Preview UI (src/app/(app)/payments/page.tsx:817–866)

Add a conditional "Excess → SCB" card alongside the existing Next Interest / Next Principal cards. It renders only when `allocation.scbApplied > 0`. Card styling follows the existing excess cards (bordered, tinted background — use a distinct color, e.g., amber/purple, so it's visually separable from the blue Next Interest and green Next Principal cards).

The top 3-column row (Penalty / Interest / Principal) is unchanged.

### Share Capital Ledger Credit (src/app/(app)/payments/page.tsx:429–447)

Replace the fixed `scb_amount` credit with `allocation.scbApplied`:

- Gate on `allocation && allocation.scbApplied > 0` instead of `selectedLoan.scb_amount > 0`.
- Pass `allocation.scbApplied` as the ledger entry amount.
- Update the toast description to show the actual credited amount.

The ledger will now match what the allocation preview showed the user.

## Out of Scope

- No change to the amortization engine in `src/lib/amortization.ts`. SCB stays in `totalDue` per period there — the payments page owns allocation display and ledger wiring.
- No change to API-side repayment handling (`repaymentService.create`). The server still receives only `amount_paid`; allocation is presentation/ledger logic on the client.
- No migration of historical repayment records.

## Testing

Manual verification in the payments page dialog using seeded loans:

1. **Loan without SCB, exact payment** — no SCB card shown, allocation matches pre-change behavior.
2. **Loan without SCB, overpayment** — excess flows to next interest then next principal (unchanged).
3. **Loan with SCB, exact current-period payment** — `scbApplied = 0`, no SCB card, no ledger credit.
4. **Loan with SCB, overpayment** — all excess appears in the "Excess → SCB" card; next-interest and next-principal cards hidden; on submit, ledger entry amount equals `scbApplied`.
5. **Loan with SCB + arrears + penalty** — penalty/overdue/current are filled first; only the remainder drains into SCB.
