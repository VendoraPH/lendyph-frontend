# Insurance Premium on Loan Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Insurance Premium capture section to the existing Loan Release dialog. Cashier enters a percentage of principal; UI computes total premium and lets them choose Full or Partial collection. Partial Amount reduces the displayed net proceeds; Remaining Balance is shown for reference. New values are sent in the release request payload.

**Architecture:** A small controlled `<InsurancePremiumSection />` component lives in `_components/` next to the loan detail page. The parent owns state (`useState`), passes principal and an `onChange` handler, and on Confirm Release sends the new fields via an extended `loanService.release()`. The dialog's existing "net proceeds" warning subtracts the upfront deduction so the cashier sees real cash-out.

**Tech Stack:** Next.js 16 + React 19, TypeScript, shadcn `RadioGroup` (already present at `src/components/ui/radio-group.tsx`), `formatCurrency` from `src/lib/format.ts`.

---

## File Structure

**Create**
- `src/app/(app)/loans/[id]/_components/insurance-premium-section.tsx` — controlled section UI + math helper
- `src/app/(app)/loans/[id]/_components/insurance-premium.types.ts` — shared `InsurancePremiumValue` type (kept tiny, ~10 lines)

**Modify**
- `src/services/loan.service.ts` — extend `release()` to accept an optional payload
- `src/app/(app)/loans/[id]/page.tsx` — host the section, own state, adjust net-proceeds warning, send payload, reset on close

No automated tests are added (matches existing pattern for the Release dialog). Verification is manual via the checklist in Task 5.

---

## Task 1: Add the shared type

**Files:**
- Create: `src/app/(app)/loans/[id]/_components/insurance-premium.types.ts`

- [ ] **Step 1: Create the type file**

```ts
export type InsurancePaymentType = "full" | "partial";

export type InsurancePremiumValue = {
  percentage: string;
  paymentType: InsurancePaymentType;
  partialAmount: string;
};

export const INSURANCE_PREMIUM_INITIAL: InsurancePremiumValue = {
  percentage: "",
  paymentType: "full",
  partialAmount: "",
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "insurance-premium.types"`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/loans/[id]/_components/insurance-premium.types.ts"
git commit -m "feat(loans): add InsurancePremiumValue shared type"
```

---

## Task 2: Build the InsurancePremiumSection component

**Files:**
- Create: `src/app/(app)/loans/[id]/_components/insurance-premium-section.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/format";
import type {
  InsurancePaymentType,
  InsurancePremiumValue,
} from "./insurance-premium.types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeInsurancePremium(
  principalAmount: number,
  value: InsurancePremiumValue,
): {
  totalPremium: number;
  upfrontDeduction: number;
  remainingBalance: number;
  partialOverflow: boolean;
} {
  const principal = Math.max(0, Number(principalAmount) || 0);
  const pct = Math.max(0, Math.min(100, Number(value.percentage) || 0));
  const totalPremium = round2(principal * (pct / 100));

  if (value.paymentType === "full") {
    return {
      totalPremium,
      upfrontDeduction: totalPremium,
      remainingBalance: 0,
      partialOverflow: false,
    };
  }

  const rawPartial = Math.max(0, Number(value.partialAmount) || 0);
  const partialOverflow = rawPartial > totalPremium;
  const partial = Math.min(rawPartial, totalPremium);

  return {
    totalPremium,
    upfrontDeduction: partial,
    remainingBalance: round2(totalPremium - partial),
    partialOverflow,
  };
}

type Props = {
  principalAmount: number;
  value: InsurancePremiumValue;
  onChange: (next: InsurancePremiumValue) => void;
  disabled?: boolean;
};

export function InsurancePremiumSection({
  principalAmount,
  value,
  onChange,
  disabled,
}: Props) {
  const { totalPremium, remainingBalance, partialOverflow } = useMemo(
    () => computeInsurancePremium(principalAmount, value),
    [principalAmount, value],
  );

  const setField = <K extends keyof InsurancePremiumValue>(
    key: K,
    next: InsurancePremiumValue[K],
  ) => onChange({ ...value, [key]: next });

  const handlePercentageBlur = () => {
    const n = Number(value.percentage);
    if (!Number.isFinite(n) || n <= 0) {
      setField("percentage", "");
      return;
    }
    const clamped = Math.max(0, Math.min(100, n));
    setField("percentage", String(round2(clamped)));
  };

  const handlePartialBlur = () => {
    const n = Number(value.partialAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setField("partialAmount", "");
      return;
    }
    const clamped = Math.max(0, Math.min(totalPremium, n));
    setField("partialAmount", String(round2(clamped)));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Insurance Premium</Label>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        {/* Row 1: percentage + computed amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="insurance-pct" className="text-xs">
              Insurance Premium Percentage
            </Label>
            <div className="relative">
              <Input
                id="insurance-pct"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                placeholder="0.00"
                value={value.percentage}
                onChange={(e) => setField("percentage", e.target.value)}
                onBlur={handlePercentageBlur}
                disabled={disabled}
                className="h-9 pr-8"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Insurance Premium Amount</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium tabular-nums">
              {formatCurrency(totalPremium)}
            </div>
          </div>
        </div>

        {/* Row 2: Full / Partial radio */}
        <div className="space-y-1.5">
          <Label className="text-xs">Payment</Label>
          <RadioGroup
            value={value.paymentType}
            onValueChange={(v) =>
              setField("paymentType", v as InsurancePaymentType)
            }
            className="flex gap-6"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="full" disabled={disabled} />
              Full
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="partial" disabled={disabled} />
              Partial
            </label>
          </RadioGroup>
        </div>

        {/* Partial subsection */}
        {value.paymentType === "partial" && (
          <div className="rounded-md border border-dashed bg-background p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="insurance-partial" className="text-xs">
                  Partial Amount
                </Label>
                <Input
                  id="insurance-partial"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={value.partialAmount}
                  onChange={(e) => setField("partialAmount", e.target.value)}
                  onBlur={handlePartialBlur}
                  disabled={disabled || totalPremium <= 0}
                  className="h-9"
                />
                {partialOverflow && (
                  <p className="text-xs text-amber-600">
                    Partial amount exceeds the total premium. It will be capped
                    to {formatCurrency(totalPremium)} on confirm.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Remaining Balance</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium tabular-nums">
                  {formatCurrency(remainingBalance)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "insurance-premium-section"`
Expected: no output

- [ ] **Step 3: Verify ESLint passes**

Run: `npx eslint "src/app/(app)/loans/[id]/_components/insurance-premium-section.tsx" --max-warnings=0`
Expected: exits 0, no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/loans/[id]/_components/insurance-premium-section.tsx"
git commit -m "feat(loans): add InsurancePremiumSection component"
```

---

## Task 3: Extend loanService.release() to accept payload

**Files:**
- Modify: `src/services/loan.service.ts` (around line 28)

- [ ] **Step 1: Read the current release method**

Run: `git show HEAD:src/services/loan.service.ts | head -40`
Expected: see `release: (id: number) => api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id)),`

- [ ] **Step 2: Add the payload type at the top of the file (after existing imports)**

In `src/services/loan.service.ts`, add this exported type immediately above the `export const loanService = {` line:

```ts
export type ReleaseLoanPayload = {
  insurance_premium_percentage?: number;
  insurance_premium_amount?: number;
  insurance_payment_type?: "full" | "partial";
  insurance_partial_amount?: number | null;
  insurance_remaining_balance?: number;
};
```

- [ ] **Step 3: Replace the existing release method**

Find:
```ts
  release: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id)),
```

Replace with:
```ts
  release: (id: number, payload?: ReleaseLoanPayload) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id), payload),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "(loan.service|release\()" | head -20`
Expected: no errors (existing call sites omit payload, still legal because it's optional)

- [ ] **Step 5: Commit**

```bash
git add src/services/loan.service.ts
git commit -m "feat(loans): extend loanService.release() with optional payload"
```

---

## Task 4: Wire the section into the Release Dialog

**Files:**
- Modify: `src/app/(app)/loans/[id]/page.tsx`

- [ ] **Step 1: Add imports**

Open `src/app/(app)/loans/[id]/page.tsx`. Add these imports at the top with the other component imports (group with other `_components/` imports if present, otherwise place near the existing imports from `./_components/` or just below the last named import from a relative path):

```tsx
import { InsurancePremiumSection } from "./_components/insurance-premium-section";
import {
  INSURANCE_PREMIUM_INITIAL,
  type InsurancePremiumValue,
} from "./_components/insurance-premium.types";
import { computeInsurancePremium } from "./_components/insurance-premium-section";
```

(If the engineer prefers a single import line for the component + helper, combine the two from `insurance-premium-section` into one.)

- [ ] **Step 2: Add state next to existing release state**

Find the line:
```tsx
  const [releaseOpen, setReleaseOpen] = useState(false);
```
(around line 1061 in the existing file).

Immediately after that block of `useState` hooks for release (just before `const [releaseDate, setReleaseDate] = useState<Date>(new Date());` or similar), add:

```tsx
  const [insurancePremium, setInsurancePremium] = useState<InsurancePremiumValue>(
    INSURANCE_PREMIUM_INITIAL,
  );
```

- [ ] **Step 3: Render the section inside the Release Dialog**

Find the closing `</div>` of the "Computed dates" block (around line 4169) — the block that contains `Maturity Date` / `First Due Date`. Immediately AFTER that closing `</div>` and BEFORE the `{/* Amortization Preview */}` comment, insert:

```tsx
            <InsurancePremiumSection
              principalAmount={Number(loan.principal_amount) || 0}
              value={insurancePremium}
              onChange={setInsurancePremium}
            />
```

- [ ] **Step 4: Adjust the dialog warning text to reflect upfront deduction**

Find the warning block (around line 4226–4237):

```tsx
            {/* Warning */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                Releasing this loan will lock the principal, interest rate, and term.
                The borrower will receive{" "}
                <span className="font-semibold">
                  {loan.net_proceeds != null ? formatCurrency(loan.net_proceeds) : formatCurrency(loan.principal_amount)}
                </span>{" "}
                as net proceeds.
              </p>
            </div>
```

Replace with:

```tsx
            {/* Warning */}
            {(() => {
              const baseNetProceeds =
                loan.net_proceeds != null
                  ? Number(loan.net_proceeds)
                  : Number(loan.principal_amount) || 0;
              const { upfrontDeduction } = computeInsurancePremium(
                Number(loan.principal_amount) || 0,
                insurancePremium,
              );
              const adjustedNetProceeds = Math.max(
                0,
                baseNetProceeds - upfrontDeduction,
              );
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    Releasing this loan will lock the principal, interest rate, and term.
                    The borrower will receive{" "}
                    <span className="font-semibold">
                      {formatCurrency(adjustedNetProceeds)}
                    </span>{" "}
                    as net proceeds
                    {upfrontDeduction > 0 && (
                      <>
                        {" "}(after {formatCurrency(upfrontDeduction)} insurance premium)
                      </>
                    )}
                    .
                  </p>
                </div>
              );
            })()}
```

- [ ] **Step 5: Send the payload from handleRelease**

Find `handleRelease` (around line 1572):

```tsx
  const handleRelease = async () => {
    try {
      ...
      const updated = await loanService.release(loan.id);
      ...
    }
    ...
  };
```

Modify the `loanService.release(loan.id)` call (the line near 1575). Replace just that line with:

```tsx
      const { totalPremium, upfrontDeduction, remainingBalance } =
        computeInsurancePremium(
          Number(loan.principal_amount) || 0,
          insurancePremium,
        );
      const releasePayload = {
        insurance_premium_percentage: Number(insurancePremium.percentage) || 0,
        insurance_premium_amount: totalPremium,
        insurance_payment_type: insurancePremium.paymentType,
        insurance_partial_amount:
          insurancePremium.paymentType === "partial" ? upfrontDeduction : null,
        insurance_remaining_balance: remainingBalance,
      };
      const updated = await loanService.release(loan.id, releasePayload);
```

- [ ] **Step 6: Reset insurance state when dialog closes**

Find the existing reset block inside the `setReleaseOpen(false)` path of `handleRelease` (or wherever the dialog is closed after success). Right next to where other release-related state is reset, add:

```tsx
      setInsurancePremium(INSURANCE_PREMIUM_INITIAL);
```

Also wire the Cancel button. Find the Cancel button inside the Release Dialog (around line 4241):

```tsx
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>
              Cancel
            </Button>
```

Replace with:

```tsx
            <Button
              variant="outline"
              onClick={() => {
                setReleaseOpen(false);
                setInsurancePremium(INSURANCE_PREMIUM_INITIAL);
              }}
            >
              Cancel
            </Button>
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "(loans/\[id\]/page|insurance)" | head -30`
Expected: no errors related to these files.

Run: `npx eslint "src/app/(app)/loans/[id]/page.tsx" --max-warnings=999 2>&1 | grep -E "(error|insurance)" | head -20`
Expected: no NEW errors (pre-existing errors in that file are out of scope; the only new lines we added must be clean).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/loans/[id]/page.tsx"
git commit -m "feat(loans): wire Insurance Premium into Release dialog"
```

---

## Task 5: Manual verification + push + PR

**No file changes — verification + delivery only.**

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: dev server starts; Next.js prints local URL.

- [ ] **Step 2: Open a loan in releasable status**

Navigate to `/loans` → click a loan with status `approved` (or any status that shows the **Release Loan** action). If none exists in the dataset, create or approve one first.

- [ ] **Step 3: Verify the section appears**

Click **Release Loan**. In the dialog, between the "Computed dates" block (Maturity Date / First Due Date) and the "Amortization Schedule Preview" table, an **Insurance Premium** card is visible with:
- Percentage input (empty)
- Insurance Premium Amount = `₱0.00`
- Payment radio defaulting to **Full**
- No Partial subsection shown.

- [ ] **Step 4: Verify percentage math**

Type `1` in the percentage field against a `₱100,000` principal. Expect Insurance Premium Amount to update to `₱1,000.00`. The warning at the bottom of the dialog should show net proceeds reduced by `₱1,000.00` and a parenthetical `(after ₱1,000.00 insurance premium)`.

- [ ] **Step 5: Verify Partial path**

Click **Partial**. The Partial subsection appears with:
- Partial Amount input (empty)
- Remaining Balance = `₱0.00` initially (since 0 of 1000 is paid)

Wait — when you switch to Partial with a blank `partialAmount`, `Remaining Balance` shows `₱1,000.00` (total − 0). Verify that's what's displayed.

Type `600` in Partial Amount. Expect:
- Remaining Balance = `₱400.00`
- Net proceeds warning subtracts `₱600.00` (not `₱1,000.00`)

- [ ] **Step 6: Verify overflow warning + clamp**

Type `9999` in Partial Amount (more than total `1000`). Inline amber warning appears: "Partial amount exceeds the total premium. It will be capped to ₱1,000.00 on confirm." Tab away (blur) — the field clamps to `1000`.

- [ ] **Step 7: Verify cancel reset**

Click **Cancel**. Re-open the Release Dialog. Insurance Premium should be back to defaults (percentage empty, paymentType=Full, no Partial subsection).

- [ ] **Step 8: Verify payload sent**

Open browser DevTools → Network tab. Set percentage to `1`, paymentType=`partial`, partial amount `600`. Click **Confirm Release**.

Locate the `PATCH /api/loans/{id}/release` request. Its request body must contain:

```json
{
  "insurance_premium_percentage": 1,
  "insurance_premium_amount": 1000,
  "insurance_payment_type": "partial",
  "insurance_partial_amount": 600,
  "insurance_remaining_balance": 400
}
```

(Numbers will vary with the loan's principal.)

If the backend rejects unknown fields with a 422, the release still surfaces the error toast — that's the cue to run the backend handoff step (Step 11).

- [ ] **Step 9: Verify blank-percentage path**

Open a fresh Release Dialog on another loan. Leave percentage blank. Net proceeds warning shows the unmodified amount with no parenthetical. Confirm release sends `insurance_premium_percentage: 0` and zeroed amounts.

- [ ] **Step 10: Final lint / build**

Run: `npm run lint 2>&1 | grep -iE "insurance" | head -20`
Expected: no output.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 11: Backend handoff (per memory rule)**

Check Swagger for `PATCH /api/loans/{id}/release`. If the endpoint does not accept the five new fields, post a chat-ready handoff (no MD file) listing:
- Endpoint path & method
- Each new field (name, type, example, nullability)
- Behavior contract: zero percentage = no premium; `insurance_partial_amount` is null for `full`, numeric for `partial`; `insurance_remaining_balance` is the leftover unpaid portion.
- Suggested storage: columns on `loans` table (`insurance_premium_amount NUMERIC(12,2)`, `insurance_premium_pct NUMERIC(5,2)`, `insurance_payment_type VARCHAR(10)`, `insurance_partial_amount NUMERIC(12,2) NULL`, `insurance_remaining_balance NUMERIC(12,2) DEFAULT 0`).

If Swagger already covers it, skip the handoff.

- [ ] **Step 12: Push branch**

Run: `git push -u origin feat/loan-release-insurance-premium`
Expected: branch published, pre-push hook (build) passes.

- [ ] **Step 13: Open PR against development**

Run:

```bash
gh pr create --base development --title "feat(loans): add Insurance Premium to Loan Release" --body "$(cat <<'EOF'
## Summary
- Adds an Insurance Premium section to the Loan Release dialog: percentage of principal, Full or Partial collection, with Partial Amount and auto-computed Remaining Balance.
- Extends `loanService.release()` to send `insurance_premium_percentage`, `insurance_premium_amount`, `insurance_payment_type`, `insurance_partial_amount`, `insurance_remaining_balance` in the request body.
- Adjusts the dialog's net-proceeds warning to reflect the upfront deduction so the cashier sees real cash-out.

## Test plan
- [ ] Type 1% percentage on a 100k principal → Premium Amount reads 1,000.00.
- [ ] Switch to Partial, enter 600 → Remaining Balance reads 400.00; warning subtracts 600.
- [ ] Over-cap partial (e.g. 9999) shows warning and clamps to total on blur.
- [ ] Blank percentage → Premium Amount = 0; warning unchanged.
- [ ] Cancel and re-open resets the section.
- [ ] Confirm Release sends the new fields in the PATCH body (DevTools verified).
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 14: Return to development branch**

Run: `git checkout development && git pull origin development`
Expected: switched and up to date.

---

## Self-Review

**Spec coverage:**
- §1 Goal — Task 4 wires the section into the dialog.
- §2 Scope — All in-scope items covered (component, computation, adjusted display, payload, handoff). Out-of-scope items (loan product schema, settings UI, automated tests) are intentionally absent.
- §3 Constraints — New UI lives in extracted component (Task 2); `release()` payload is optional preserving call sites (Task 3); uses `formatCurrency` (Task 2).
- §4 User stories — All five covered by Tasks 2 + 4 + 5.
- §5.1 Files — Matches Tasks 1–4 exactly.
- §5.2 State — Task 4 Step 2.
- §5.3 Derivation — Task 2 (`computeInsurancePremium`, `round2` defined inline).
- §5.4 Net proceeds display — Task 4 Step 4.
- §6 Component contract — Task 2 component matches.
- §7 Data flow — Task 4 Step 5.
- §8 Service layer — Task 3.
- §9 Backend handoff — Task 5 Step 11.
- §10 Edge cases — clamping in Task 2 (`handlePercentageBlur`, `handlePartialBlur`); overflow warning in Task 2; reset on cancel in Task 4 Step 6.
- §11 Testing — Task 5 Steps 3–10.
- §12 Risks / §13 Open questions — narrative only, no implementation needed.

**Placeholder scan:** None — every step has concrete code or commands.

**Type consistency:** `InsurancePremiumValue` used identically across Task 1 (definition), Task 2 (consumed via prop), Task 4 (state). `computeInsurancePremium` defined in Task 2, used in Task 4. `ReleaseLoanPayload` defined in Task 3, consumed implicitly by Task 4. `insurance_partial_amount` is `null` (not omitted) when `paymentType === "full"` — consistent between Task 4 Step 5 payload construction and Task 3 type (`number | null`).
