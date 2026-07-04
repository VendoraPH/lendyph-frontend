# Amortization BINHS — Design Spec

**Date:** 2026-05-17
**Status:** Approved (verbal)
**Scope:** Frontend-only. No backend or RBAC changes.

---

## 1. Goal

Add a new sub-page under **Loans** that demonstrates the BINHS amortization computation — a special schedule that compounds **penalty + previous unpaid principal** whenever a due is left unpaid for more than 30 days. The page is a calculator (inputs + table view) with three tabs (Ideal / Worst Case / Custom). It can also be linked to from a loan's detail page with the loan's terms pre-filled.

## 2. The BINHS rules (from source Excel)

1. If a due is left unpaid for more than 30 days, the previous PRIN and current PRIN are added together (carried).
2. The PENALTY is **20%** of the new PRIN (previous + current).
3. The INTEREST and PENALTY are added to the outstanding principal balance.
4. For succeeding unpaid dues, the interest is based on the **new outstanding principal balance**, while the PRIN keeps being added to the previous PRIN.

Penalty rate is fixed at **20%** (BINHS standard).

## 3. Architecture

```
src/lib/binhs.ts                                     # pure math (testable)
src/lib/__tests__/binhs.test.ts                      # unit tests
src/app/(app)/loans/amortization-binhs/
  page.tsx                                           # composes form + tabs + deep-link
  _components/
    binhs-input-form.tsx                             # inputs (top of page)
    binhs-schedule-table.tsx                         # reusable table; takes BinhsRow[]
    binhs-ideal-tab.tsx                              # buildIdealSchedule
    binhs-worst-case-tab.tsx                         # buildWorstCaseSchedule
    binhs-custom-tab.tsx                             # paid/unpaid checkboxes + buildCustomSchedule
```
Plus:
- One nav entry in `src/constants/navigation.ts` (sibling of "Amortization Calculator").
- A "View BINHS Schedule" button on the loan detail page.

## 4. Math (`src/lib/binhs.ts`)

### 4.1 Inputs

```ts
export interface BinhsInput {
  principal: number;             // > 0
  annualInterestRate: number;    // % per year, e.g., 24
  termMonths: number;            // 1..60
  scbuPerPeriod: number;         // flat peso, >= 0
  startDate: string;             // ISO YYYY-MM-DD (first due date)
}
```

### 4.2 Output row

```ts
export interface BinhsRow {
  period: number;
  dueDate: string;               // ISO YYYY-MM-DD
  principal: number;             // PRIN due this period (carried if chained)
  interest: number;
  penalty: number;
  scbu: number;
  totalPayment: number;          // PRIN + interest + penalty + SCBU for this row
  runningBalance: number;        // outstanding principal AFTER this period
}
```

### 4.3 Constants

```ts
export const BINHS_PENALTY_RATE = 0.20;
```

### 4.4 Builders

#### `buildIdealSchedule(input): BinhsRow[]`
Straight diminishing-balance amortization. Matches LEFT table of Excel.
- Monthly rate `r = annualInterestRate / 12 / 100`.
- Level payment via PMT: `pmt = principal * r / (1 - (1 + r) ^ -n)`.
- Each period: `interest = balance * r`, `principalPaid = pmt - interest`, `balance -= principalPaid`.
- `penalty = 0`, `scbu = scbuPerPeriod`.
- `totalPayment = principalPaid + interest + scbu` (no penalty in ideal).

#### `buildWorstCaseSchedule(input): BinhsRow[]`
No dues paid; every row compounds. Matches RIGHT table of Excel.
- Pre-compute the **scheduled** ideal `principalPaid[i]` from `buildIdealSchedule` (these are the per-period PRINs that would have been due).
- For each period `i`:
  - `carriedPrin = sum(scheduledPrincipals[0..i])` (rule 1 & 4)
  - `penalty = carriedPrin * BINHS_PENALTY_RATE` (rule 2)
  - `interest = outstandingBalance * r` (where `outstandingBalance` is the running balance going into this period — rule 4)
  - `newOutstanding = outstandingBalance + interest + penalty` (nothing was paid; balance grows — rule 3)
  - `scbu = scbuPerPeriod`
  - `totalPayment = scheduledPmt + scbu` (display the scheduled monthly payment, not what was paid)
  - Row's `principal` column shows `carriedPrin`, row's `runningBalance` shows `newOutstanding`.

#### `buildCustomSchedule(input, paidFlags: boolean[]): BinhsRow[]`
Same engine, per-row state machine:
- Maintain `carriedPrin` (running unpaid PRIN chain) and `outstandingBalance`.
- For each period `i`:
  - Compute `scheduledPrin[i]` from ideal schedule.
  - If `paidFlags[i] === true`:
    - **Chain breaks.** This period's `principal` settles its own `scheduledPrin[i]` plus any `carriedPrin` so far.
    - `interest = outstandingBalance * r` (normal interest on current balance)
    - `penalty = 0`
    - `outstandingBalance -= (carriedPrin + scheduledPrin[i])`
    - `carriedPrin = 0`
  - Else (unpaid):
    - `carriedPrin += scheduledPrin[i]`
    - `penalty = carriedPrin * BINHS_PENALTY_RATE`
    - `interest = outstandingBalance * r`
    - `outstandingBalance += (interest + penalty)`
    - Row shows `principal = carriedPrin`.

### 4.5 Rounding

All currency values rounded to 2 decimals at row level using a `round2(n)` helper (`Math.round(n * 100) / 100`). Totals computed from rounded rows.

## 5. UI

### 5.1 Page (`/loans/amortization-binhs`)

- `<RouteGuard permission="loans:view" pageName="Amortization BINHS">`
- Header: "Amortization (BINHS)" + 1-paragraph description of rules.
- `<BinhsInputForm>` card on top.
- shadcn `<Tabs defaultValue="ideal">` with three triggers and three content panels:
  - **Ideal** — `<BinhsIdealTab input={input} />`
  - **Worst Case** — `<BinhsWorstCaseTab input={input} />`
  - **Custom** — `<BinhsCustomTab input={input} />` (manages its own `paidFlags` state)
- Empty state in each tab when input is invalid.

### 5.2 `<BinhsInputForm>` fields

| Field | Control | Default | Notes |
|---|---|---|---|
| Principal | Input number | 10000 | > 0 |
| Annual interest rate (%) | Input number | 24 | ≥ 0 |
| Term (months) | Input number | 6 | 1..60 |
| SCBU per period (₱) | Input number | 100 | ≥ 0 |
| Start date (first due) | Input date | today + 30 days | required |
| Penalty rate | Read-only label "20% (BINHS standard)" | — | not editable |

Inline validation under each field; "Compute" button disabled until inputs are valid. Inputs lift state to the page via a single `input` object so all tabs read the same values.

### 5.3 `<BinhsScheduleTable rows={...}>` columns

`#` · Due Date · Principal · Interest · Penalty · Share Capital Build-Up · Total Payment · Running Balance

Footer row sums Principal / Interest / Penalty / SCBU / Total Payment. Money formatted via `formatCurrency` from `src/lib/format.ts`.

### 5.4 `<BinhsCustomTab>` extras

Adds a "Paid?" checkbox cell as the first body cell. Toggling re-runs `buildCustomSchedule` immediately (cheap; no async).

### 5.5 Deep-link from loan detail

On the loan detail page (`src/app/(app)/loans/[id]/page.tsx`), add a secondary Button:
> "View BINHS Schedule" → `/loans/amortization-binhs?loan_id={loan.id}`

On the BINHS page:
- `useSearchParams().get("loan_id")`.
- If present and not already prefilled, call `useLoan(Number(loanId))`. Map loan fields → form inputs (`principal_amount` → principal, `interest_rate` → annual interest rate, `term` → termMonths, `start_date` → startDate). Use `scbu_per_period = 0` if the loan record doesn't expose it.
- One-time prefill (track with a ref so user edits don't get clobbered).

## 6. Nav & access

Add entry to `src/constants/navigation.ts` under `Loans.children`, after `Amortization Calculator`:

```ts
{ title: "Amortization BINHS", href: "/loans/amortization-binhs" },
```

Access: `loans:view`. No new permission.

## 7. Edge cases

- **Invalid input** — tabs render an empty-state card "Enter valid inputs to compute the schedule."
- **Zero interest** — `r = 0`, level payment becomes `principal / n`; formula `pmt = principal * r / (1 − (1+r)^−n)` divides by zero, so branch: if `r === 0`, `pmt = principal / n`.
- **Term 1** — schedule is a single row; tests cover this.
- **All paid in Custom** — equivalent to Ideal (chain never accumulates).
- **All unpaid in Custom** — equivalent to Worst Case.
- **Rounding drift** — round at row creation, totals sum rounded rows; ±₱0.01 tolerance acceptable for display.

## 8. Tests

`src/lib/__tests__/binhs.test.ts`:

- **Ideal — Excel example:** input `{ principal: 10000, annualRate: 24, term: 6, scbu: 100, startDate: '2026-05-06' }` → totals: principal ₱10,000, interest ₱711 (±₱1), SCBU ₱600, total payment ₱11,311 (±₱1). Last row's `runningBalance ≈ 0`.
- **Worst Case — Excel example:** row 1 penalty `≈ 317`, row 2 carried principal `≈ 3202`, row 2 penalty `≈ 640.40`, row 6 final running balance `≈ 16615.09` (±₱1).
- **Custom — chain reset:** pattern `[paid, unpaid, paid, unpaid, paid, paid]`. After period 1 paid, `carriedPrin === 0` before period 2. Period 3 paid settles period 2's carried PRIN.
- **Zero interest:** principal ₱6000, rate 0%, term 6 → every row's interest 0, principal ₱1000.
- **Term = 1:** single row, principal fully due, ideal interest ≈ principal × r.

## 9. Out of scope

- Export (CSV/PDF) — follow-up if needed.
- Persisting schedules to backend.
- Pulling actual payment history into the per-loan view (pre-fill inputs only).
- Editing penalty rate or SCBU rules per branch/product.

## 10. Files touched

**Created:**
- `src/lib/binhs.ts`
- `src/lib/__tests__/binhs.test.ts`
- `src/app/(app)/loans/amortization-binhs/page.tsx`
- `src/app/(app)/loans/amortization-binhs/_components/binhs-input-form.tsx`
- `src/app/(app)/loans/amortization-binhs/_components/binhs-schedule-table.tsx`
- `src/app/(app)/loans/amortization-binhs/_components/binhs-ideal-tab.tsx`
- `src/app/(app)/loans/amortization-binhs/_components/binhs-worst-case-tab.tsx`
- `src/app/(app)/loans/amortization-binhs/_components/binhs-custom-tab.tsx`

**Modified:**
- `src/constants/navigation.ts` — add sidebar entry
- `src/app/(app)/loans/[id]/page.tsx` — add "View BINHS Schedule" button
