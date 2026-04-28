# Fee Management — Design Spec

**Date:** 2026-04-08
**ClickUp Task:** [New Loan Application | Other Deductions](https://app.clickup.com/t/86d2jwqyc) + Settings > Fees
**Branch:** TBD (will be created during implementation)

## Overview

Add a dedicated Fee Management page under Settings where users can create, edit, and delete custom fees. Each fee defines a name, type (fixed or percentage), value, which loan products it applies to, and optional conditions based on term or loan amount.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where fees live | Separate page (Settings > Fees) | Fees are reusable across products; task describes "applicable to which loans" checkbox |
| Fee types | Fixed & Percentage now; Formula as "coming soon" | Keeps scope manageable; Formula needs a builder UI |
| Conditions | Build UI & save data, no backend evaluation | Frontend-ready for when backend supports conditional fee logic |
| Tiered Charges | Coming soon (disabled in UI) | Per task description |

## Data Model

### Fee Interface

```typescript
interface Fee {
  id: number;
  name: string;
  type: "fixed" | "percentage";  // "formula" added later
  value: number;                  // amount in PHP (fixed) or percentage
  applicable_product_ids: number[];
  conditions: FeeConditions;
  created_at: string;
  updated_at: string;
}

interface FeeConditions {
  term_days_gt?: number;    // greater than
  term_days_lt?: number;    // less than
  term_days_eq?: number;    // equal to
  loan_amount_gt?: number;
  loan_amount_lt?: number;
  loan_amount_eq?: number;
}
```

### Form State

```typescript
interface FeeForm {
  name: string;
  type: "fixed" | "percentage";
  value: string;
  applicable_product_ids: number[];
  term_days_gt: string;
  term_days_lt: string;
  term_days_eq: string;
  loan_amount_gt: string;
  loan_amount_lt: string;
  loan_amount_eq: string;
}
```

## Page Structure

### Route & Navigation

- **Page:** `/settings/fees` → `src/app/(app)/settings/fees/page.tsx`
- **Sidebar:** Settings > Fees (new entry in `navigation.ts`)
- **Permission:** `settings:view` (same as other settings pages)

### Page Layout (mirrors Loan Products page exactly)

1. **Header:** Title "Fee Management" + description + orange "Add New Fee" button
2. **Summary Cards:** 3 cards — Total Fees, Fixed, Percentage
3. **Table (desktop) / Card list (mobile):**
   - Columns: Name, Type (badge), Value, Applies To, Conditions, Actions (⋯)
   - Type badges: green for Fixed, blue for Percentage
   - Actions dropdown: Edit, Delete

### Dialog Form (mirrors Product Form Dialog)

- `DialogContent size="lg"` with scrollable content
- Sections with uppercase tracking-wider headings:

**1. Basic Info**
- Fee Name (text, required)
- Type (Select: Fixed / Percentage / Formula (disabled), required)
- Amount/Value (number, required) — label changes: "Amount (PHP)" for fixed, "Rate (%)" for percentage

**2. Applicable Loan Products**
- Checkbox list of all loan products (fetched from `loanProductService.list()`)
- At least one must be selected

**3. Additional Conditions** (optional)
- Two grouped panels side by side (sm:grid-cols-2):
  - **Term (Days):** Greater than, Less than, Equal to — all optional number inputs
  - **Loan Amount:** Greater than, Less than, Equal to — all optional number inputs

**4. Tiered Charges** — disabled section with "Coming Soon" badge

### Components & Patterns

- Same local `useState` pattern (no form library)
- Same `update(field, value)` helper
- Same error handling with toast notifications
- Same brand-orange primary buttons, outline cancel buttons
- Same `DropdownMenu` for row actions
- Same mobile card view / desktop table pattern

## API Integration

### Service: `src/services/fee.service.ts`

```typescript
export const feeService = {
  list: () => api.get<Fee[]>("/fees"),
  create: (data: CreateFeeData) => api.post<Fee>("/fees", data),
  update: (id: number, data: UpdateFeeData) => api.put<Fee>(`/fees/${id}`, data),
  delete: (id: number) => api.delete(`/fees/${id}`),
};
```

### Endpoints: `src/config/api-endpoints.ts`

```typescript
FEES: {
  LIST: "/fees",
  CREATE: "/fees",
  DETAIL: (id: number) => `/fees/${id}`,
  UPDATE: (id: number) => `/fees/${id}`,
  DELETE: (id: number) => `/fees/${id}`,
}
```

**Note:** If the backend API is not yet available, the page should handle API errors gracefully (show empty state, toast errors). The UI is built frontend-first.

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/app/(app)/settings/fees/page.tsx` — main page |
| Create | `src/services/fee.service.ts` — API service |
| Create | `src/types/fee.ts` — Fee types |
| Modify | `src/config/api-endpoints.ts` — add FEES endpoints |
| Modify | `src/constants/navigation.ts` — add Fees to sidebar |
| Modify | `src/types/index.ts` — re-export fee types |
| Modify | `src/services/index.ts` — re-export fee service |

## Out of Scope

- Formula fee type (coming soon)
- Tiered charges (coming soon)
- Backend evaluation of conditions when creating loans
- Migration of existing hardcoded fees (processing_fee, service_fee) from loan products
