# Auto-Pay Feature — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  

---

## Overview

Auto-Pay is a batch loan repayment feature that lets staff process dues for multiple loans at once. The actual debit of funds is handled by an external CBS (Core Banking System). LendyPH's role is to compute the expected totals, surface them for verification against the CBS report, handle a partial-payment review step, and then post repayment records for all included loans once confirmed.

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Page structure | 2-step wizard (single route, React state) | Partial rows review needs full-page space; two steps make batch confirmation feel intentional |
| Payment method | New `auto_pay` method type | Distinguishes batch auto-pay from manual payments in history/reporting |
| Past due loans | Excluded entirely | Past due loans require manual review and payment; auto-pay is for current dues only |
| Partial rows | Surfaced for per-row include/skip decision | Staff must explicitly choose to include or skip each partially-paid row |
| Per-loan toggle | Toggle + required CBS reference (when enabling) | CBS reference links the loan to the debit entry in the external banking system |

---

## Feature Areas

### 1. Navigation

Add **Auto-Pay** as a third submenu item under **Payments** in `src/constants/navigation.ts`:

```
Payments
├── New Payment       /payments
├── Payment History   /payments/history
└── Auto-Pay          /payments/auto-pay   ← new
```

Permission: `payments:view` (same as existing payment pages — refine to a dedicated permission if RBAC requires it in future).

---

### 2. Auto-Pay Batch Page (`/payments/auto-pay`)

A single-route, two-step wizard. Step is tracked in local React state (no URL change between steps).

#### Step 1 — Filters

| Field | Type | Behaviour |
|---|---|---|
| Loan Products | Multi-checkbox | "All Products" option at top; selecting it deselects individual products and vice-versa. Populated from `/api/loan-products`. |
| Date Range — From | Date picker | Inclusive start date |
| Date Range — To | Date picker | Inclusive end date. Must be ≥ From. |

Clicking **Preview Auto-Pay** calls `GET /api/auto-pay/preview` and transitions to Step 2.

Eligible loans for preview: `auto_pay_enabled = true`, loan status in `[released, current]`, at least one amortization schedule row with `status = pending` and `due_date` within the selected range.

#### Step 2 — Review & Confirm

**Summary cards (top row):**
- Total Principal to Pay
- Total Interest to Pay
- Number of Loans Affected

Summary totals update live as staff toggle partial rows include/skip.

**Partial Rows section** (shown only if partial rows exist):

A warning panel listing all schedule rows with `status = partial` that fall in the date range. Columns: Borrower name, Loan account, Due date, Period, Remaining balance. Each row has an **Include / Skip** toggle (defaults to Include).

Only the remaining balance (principal + interest) of a partial row is submitted when included.

**CBS verification note:**

An info banner reminding staff to compare the totals above against the CBS report before confirming. If amounts differ, they click **← Back** to adjust.

**Actions:**
- **← Back** — returns to Step 1 (filters preserved in state)
- **✓ Run Auto-Pay** — calls `POST /api/auto-pay/process`; on success shows a result toast and resets to Step 1

---

### 3. Per-Loan Auto-Pay Toggle

#### 3a. At Loan Release

After the release action succeeds, a follow-up dialog appears (non-blocking — staff can dismiss it):

- **Auto-Pay toggle** (default: off)
- **CBS Reference No.** text field — required when toggle is on
- **Skip for Now** button — dismisses without enabling
- **Save & Close** button — calls `PATCH /api/loans/{id}/auto-pay` then dismisses

#### 3b. All Loans List

A new **Auto-Pay** column shows the status of each released loan:

| Status | Badge |
|---|---|
| Enabled | Blue "● Enabled" badge |
| Disabled | Grey "○ Disabled" badge |
| Not applicable (past due, draft, etc.) | "— N/A" |

The **Actions** column for released loans gains an **Enable** / **Disable** link that opens an inline dialog (same fields as the release dialog above).

#### 3c. Loan Detail Page

A small **Auto-Pay status card** in the loan detail page showing:
- Current status (Enabled / Disabled)
- CBS Reference (when enabled)
- Date enabled
- **Disable Auto-Pay** / **Enable Auto-Pay** button

---

## API Contracts

### `GET /api/auto-pay/preview`

**Query params:**

| Param | Type | Notes |
|---|---|---|
| `product_ids[]` | integer[] | Optional. Omit or leave empty = all products |
| `date_from` | date string | ISO format e.g. `2026-04-01` |
| `date_to` | date string | ISO format e.g. `2026-04-30` |

**Response:**
```json
{
  "summary": {
    "total_principal": 84500.00,
    "total_interest": 6200.00,
    "total_amount": 90700.00,
    "loans_count": 23
  },
  "partial_rows": [
    {
      "loan_id": 42,
      "schedule_id": 156,
      "borrower_name": "J. Santos",
      "loan_account": "LN-2025-042",
      "due_date": "2026-04-15",
      "period_number": 3,
      "total_due": 3800.00,
      "amount_paid": 2600.00,
      "remaining_balance": 1200.00,
      "principal_remaining": 1000.00,
      "interest_remaining": 200.00
    }
  ]
}
```

`summary` counts and totals cover **fully pending** rows only. Partial rows are listed separately and excluded from summary until staff includes them (frontend recalculates summary when partial rows are toggled).

---

### `POST /api/auto-pay/process`

**Request body:**
```json
{
  "product_ids": [1, 2],
  "date_from": "2026-04-01",
  "date_to": "2026-04-30",
  "include_schedule_ids": [156, 301]
}
```

| Field | Notes |
|---|---|
| `product_ids` | Empty array = all products |
| `include_schedule_ids` | Schedule IDs of partial rows staff chose to include. Fully-pending rows are always included automatically. |

Backend creates one repayment record per affected loan. Amount = sum of all included dues for that loan. Payment method stored = `auto_pay`.

**Response:**
```json
{
  "processed": 23,
  "skipped": 1,
  "failed": 0,
  "repayments": [
    { "loan_id": 42, "repayment_id": 789, "amount_paid": 3800.00 }
  ]
}
```

---

### `PATCH /api/loans/{id}/auto-pay`

**Request body:**
```json
{
  "enabled": true,
  "cbs_reference": "CBS-2026-00123"
}
```

| Field | Notes |
|---|---|
| `enabled` | Boolean. Required. |
| `cbs_reference` | Required when `enabled: true`. Ignored / can be null when `enabled: false`. |

Only allowed on loans with status `released` or `current`. Past due, draft, and completed loans return `422`.

**Response:**
```json
{
  "loan_id": 42,
  "auto_pay_enabled": true,
  "cbs_reference": "CBS-2026-00123",
  "enabled_at": "2026-04-29T10:00:00Z",
  "enabled_by_user_id": 5
}
```

---

## Data Model Changes

### `loans` table — new columns

| Column | Type | Notes |
|---|---|---|
| `auto_pay_enabled` | boolean | Default `false` |
| `auto_pay_cbs_reference` | varchar, nullable | Null when disabled |
| `auto_pay_enabled_at` | timestamp, nullable | Set when enabled |
| `auto_pay_enabled_by` | FK to users, nullable | Audit trail |

### `repayments` table — payment method

Add `auto_pay` to the `method` enum alongside existing values (`cash`, `bank_transfer`, `gcash`, `maya`, `online`).

---

## New Frontend Files

| File | Purpose |
|---|---|
| `src/app/(app)/payments/auto-pay/page.tsx` | Auto-Pay wizard page (Steps 1 + 2) |
| `src/app/(app)/payments/auto-pay/_components/filters-step.tsx` | Step 1 — product checkboxes + date range |
| `src/app/(app)/payments/auto-pay/_components/review-step.tsx` | Step 2 — summary cards + partial rows table + confirm |
| `src/app/(app)/payments/auto-pay/_components/partial-rows-table.tsx` | Partial rows include/skip table |
| `src/components/auto-pay-toggle-dialog.tsx` | Shared dialog for enabling/disabling Auto-Pay (used at release + All Loans + detail) |
| `src/services/auto-pay.service.ts` | `preview()`, `process()` |
| `src/types/auto-pay.ts` | `AutoPayPreview`, `AutoPayFilter`, `AutoPayResult`, `AutoPaySettings` |

---

## Modified Frontend Files

| File | Change |
|---|---|
| `src/constants/navigation.ts` | Add Auto-Pay submenu item |
| `src/app/(app)/loans/[id]/page.tsx` | Add Auto-Pay status card |
| `src/app/(app)/loans/page.tsx` | Add Auto-Pay column + Enable/Disable action |
| `src/services/loan.service.ts` | Add `toggleAutoPay(id, data)` |
| `src/config/api-endpoints.ts` | Add `AUTO_PAY` endpoint group + `LOANS.TOGGLE_AUTO_PAY` |
| `src/types/loan.ts` | Add `auto_pay_enabled`, `auto_pay_cbs_reference`, `auto_pay_enabled_at` to `Loan` type |
| `src/types/payment.ts` | Add `auto_pay` to payment `method` union type |
| `src/app/(app)/loans/[id]/page.tsx` | Add post-release Auto-Pay dialog (triggered after release action succeeds) |

---

## Out of Scope

- Automatic/scheduled execution (no cron — this is always staff-triggered)
- Past due loan inclusion (excluded by design)
- Per-loan payment amount override (always the exact schedule due amount)
- CBS integration (CBS operates independently; LendyPH only verifies totals match)
