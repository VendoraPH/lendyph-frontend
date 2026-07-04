# Insurance Premium on Loan Release — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Owner:** Augustin Maputol

## 1. Goal

Add an Insurance Premium capture section to the existing Loan Release dialog so the cashier can record an insurance premium (percentage of principal, full or partial collection) at the moment of release. The Partial Amount reduces the cash handed to the borrower; the Remaining Balance is tracked as an outstanding insurance liability and does not modify the loan's principal or amortization schedule.

## 2. Scope

**In scope**
- New `<InsurancePremiumSection />` component used inside the Release Dialog on the loan detail page.
- Live computation of Premium Amount and Remaining Balance.
- Adjusted "net proceeds" warning text inside the dialog (display-only — does not mutate `loan.net_proceeds`).
- Extending the release service call to include the new fields in the payload.
- Backend handoff document (chat-ready) if the release endpoint does not yet accept the new fields.

**Out of scope**
- Storing insurance premium on the loan product (no schema change to products).
- Settings UI for default premium rates.
- Tracking/aging the Remaining Balance as a separate ledger record (backend may persist it; UI exposure for collection is a future task).
- Editing the premium after release.
- Automated tests for the release dialog (matches existing pattern in this file).

## 3. Constraints

- Cannot grow `src/app/(app)/loans/[id]/page.tsx` further in a meaningful way — the file is already over 4,250 lines. The new UI must live in an extracted child component.
- Must not change the public shape of `loanService.release()` for callers that do not pass the new payload (backward compatible default).
- Currency display uses `formatCurrency` from `src/lib/format.ts` (project convention).
- Must follow the existing Release Dialog visual language (rounded card, muted background, two-column grids, consistent label sizing).

## 4. User Stories

1. As a cashier, I want to enter an insurance premium percentage so the system computes the premium amount against the loan principal automatically.
2. As a cashier, I want to choose Full or Partial collection so I can record what the borrower actually paid up front.
3. As a cashier, when I select Partial, I want to enter the Partial Amount and see the Remaining Balance auto-computed so I do not have to do arithmetic in my head.
4. As a cashier, I want the dialog's "borrower will receive" amount to reflect the upfront insurance deduction so I hand over the correct cash.
5. As a finance officer, I want the captured values persisted on the release so the back office can reconcile and bill the remaining balance later.

## 5. Architecture

### 5.1 Files

**Create**
- `src/app/(app)/loans/[id]/_components/insurance-premium-section.tsx` — the new section component.

**Modify**
- `src/app/(app)/loans/[id]/page.tsx` — host the section, own its state, adjust the warning text, send new fields in `handleRelease`.
- `src/services/loan.service.ts` — extend `release()` to accept an optional payload.

### 5.2 State

The parent `LoanDetailPage` owns the state:

```ts
type InsurancePremiumValue = {
  percentage: string;            // user input; "" means no premium
  paymentType: "full" | "partial";
  partialAmount: string;         // only used when paymentType === "partial"
};

const [insurancePremium, setInsurancePremium] = useState<InsurancePremiumValue>({
  percentage: "",
  paymentType: "full",
  partialAmount: "",
});
```

Resetting: when the Release Dialog is closed (cancel) or a release succeeds, reset to the initial value so a re-open starts clean.

### 5.3 Derivation

Computed in the section component via a small pure helper, NOT stored in state:

```ts
function computeInsurancePremium(
  principalAmount: number,
  value: InsurancePremiumValue,
): {
  totalPremium: number;
  upfrontDeduction: number;
  remainingBalance: number;
} {
  const pct = Math.max(0, Math.min(100, Number(value.percentage) || 0));
  const total = round2(principalAmount * (pct / 100));

  if (value.paymentType === "full") {
    return { totalPremium: total, upfrontDeduction: total, remainingBalance: 0 };
  }

  const partial = Math.max(0, Math.min(total, Number(value.partialAmount) || 0));
  return {
    totalPremium: total,
    upfrontDeduction: partial,
    remainingBalance: round2(total - partial),
  };
}
```

`round2` is the standard 2-decimal helper used elsewhere in the codebase (already present in `src/lib`).

### 5.4 Net proceeds display

In the existing dialog warning (`page.tsx` ~line 4233), replace the hard reference to `loan.net_proceeds` with:

```ts
const adjustedNetProceeds = (loan.net_proceeds ?? loan.principal_amount) - upfrontDeduction;
```

Only the display text changes. The stored `loan.net_proceeds` is untouched until the backend recomputes on release.

## 6. Component Contract

```ts
type InsurancePremiumSectionProps = {
  principalAmount: number;
  value: InsurancePremiumValue;
  onChange: (next: InsurancePremiumValue) => void;
  disabled?: boolean;
};
```

**Rendering rules**
- Header: "Insurance Premium" (matches the existing section header style — `Label` element).
- Row 1 (two columns on `sm:`):
  - Premium % — `Input` with suffix `%`. Empty default. Accepts decimal up to 2 places.
  - Premium Amount — read-only display via `formatCurrency(totalPremium)`.
- Row 2: Radio group "Full" / "Partial" (use the shadcn `RadioGroup` already in the project; if not present, use simple `<label><input type="radio">` styled like the existing toggles in the release dialog — confirmed during implementation).
- When `paymentType === "partial"`:
  - Show a nested card (rounded border, muted bg) with:
    - Partial Amount — `Input` with `₱` prefix.
    - Remaining Balance — read-only display via `formatCurrency(remainingBalance)`.
  - Show inline warning text when `Number(partialAmount) > totalPremium`: "Partial amount exceeds the total premium. It will be capped to the total on confirm."

**Disabled state**
- When `disabled` is true, all inputs become non-interactive (used while the release request is in flight).

**Validation**
- Percentage clamped 0–100 on blur.
- Partial Amount clamped 0–`totalPremium` on blur.
- Empty percentage is valid and means "no insurance premium" — the section still renders but Premium Amount shows ₱0.00 and the Partial subsection is effectively no-op.

## 7. Data Flow

```
page.tsx (state owner)
  │  principalAmount = loan.principal_amount
  │  insurancePremium = { percentage, paymentType, partialAmount }
  │
  ├── <InsurancePremiumSection
  │       principalAmount={…}
  │       value={insurancePremium}
  │       onChange={setInsurancePremium}
  │       disabled={releasing}
  │    />
  │
  └── handleRelease():
        1. compute(insurancePremium, principal) → { totalPremium, upfrontDeduction, remaining }
        2. payload = {
             insurance_premium_percentage: Number(percentage) || 0,
             insurance_premium_amount: totalPremium,
             insurance_payment_type: paymentType,
             insurance_partial_amount: paymentType === "partial" ? upfrontDeduction : null,
             insurance_remaining_balance: remaining,
           }
        3. await loanService.release(loan.id, payload)
        4. reset insurancePremium state on success/cancel
```

When percentage is blank/0 and totalPremium is 0, the keys are still sent (zeroed). Backend treats zero values as "no premium".

## 8. Service Layer Change

`src/services/loan.service.ts`:

```ts
export type ReleaseLoanPayload = {
  insurance_premium_percentage?: number;
  insurance_premium_amount?: number;
  insurance_payment_type?: "full" | "partial";
  insurance_partial_amount?: number | null;
  insurance_remaining_balance?: number;
};

async release(id: number, payload?: ReleaseLoanPayload): Promise<Loan> {
  return api.post(endpoints.loans.release(id), payload ?? {});
}
```

All fields optional — preserves existing call sites that pass no payload.

## 9. Backend Handoff

After implementation, check Swagger for the loans release endpoint:

- If it already accepts the five fields above — done, no handoff.
- If not — produce a chat-ready handoff per memory rule, listing:
  - Endpoint: `POST /api/loans/{id}/release` (or whatever current path is)
  - New request body fields with types and example values
  - Expected behavior (zero values = no premium; partial requires `partial_amount` and `remaining_balance > 0` together)
  - Suggested DB columns on `loans` (or a side table if remaining_balance is to be tracked as a receivable).

## 10. Edge Cases

1. **Principal is 0 or missing** — Premium Amount is 0 regardless of percentage; section still renders.
2. **Percentage typed with leading "."** (e.g. ".5") — `Number(value)` handles this; display preserves the string until blur, where we re-parse and re-stringify if invalid.
3. **Partial selected but Partial Amount blank** — treated as 0, Remaining Balance equals total. Payload sends `insurance_partial_amount: 0` and full `remaining_balance`.
4. **Partial Amount exceeds total** — clamped on blur, warning shown live until clamped.
5. **User toggles Full → Partial → Full** — `partialAmount` retained in state but not used while Full is selected (matches typical form UX).
6. **Negative inputs** — Number inputs use `min={0}`; pasted negatives are clamped on blur.

## 11. Testing

Manual smoke test, no new automated tests this iteration (matches existing release dialog).

Checklist:
- [ ] Open Release Dialog on a draft loan — Insurance Premium section visible between Computed dates and Amortization Preview.
- [ ] Type percentage `1` against a `₱100,000` principal — Premium Amount reads `₱1,000.00`.
- [ ] With Full selected, the warning text shows `₱1,000` less than `loan.net_proceeds`.
- [ ] Switch to Partial, enter `₱600` — Remaining Balance reads `₱400.00`; warning text adjusts to net_proceeds − 600.
- [ ] Enter Partial Amount `₱9,999` (greater than total) — warning shown; clamped to `₱1,000` on blur.
- [ ] Blank percentage — Premium Amount = `₱0.00`, warning text matches the existing `loan.net_proceeds`.
- [ ] Confirm release with non-zero values — DevTools Network shows the new five fields in the request body.
- [ ] Cancel and re-open — section is reset to defaults.

## 12. Risks

- **Backend not ready** — handled by handoff (memory rule). Frontend can ship with payload pre-wired; backend either accepts (and stores) or silently ignores until ready.
- **Net-proceeds display divergence** — adjusted figure in the dialog is purely cosmetic; truth-of-record stays `loan.net_proceeds`. Acceptable for v1; backend reconciliation closes the loop later.
- **Remaining-balance tracking** — without a dedicated insurance receivable model, the Remaining Balance is just a column on the release record. Collection workflow is a separate future spec; called out in §2.

## 13. Open Questions

None at spec time. Open questions discovered during implementation will be brought back for a quick decision.
