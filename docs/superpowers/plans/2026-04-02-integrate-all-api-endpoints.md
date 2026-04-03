# Integrate All Backend API Endpoints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mock/hardcoded data in frontend pages with real backend API calls using the existing service layer.

**Architecture:** Each page currently uses inline mock data arrays. We replace those with `useEffect` + service calls, add loading/error states, and wire action handlers to real API endpoints. The service layer and types already exist — we only change the page files.

**Tech Stack:** Next.js (App Router), React, TypeScript, Axios (via api-client.ts), existing service layer

---

## Scope

**Pages to integrate (have documented backend APIs):**

| # | Page | File | Key Changes |
|---|------|------|-------------|
| 1 | Borrower Detail | `src/app/(app)/borrowers/[id]/page.tsx` | Replace 4 mock data sources with API calls |
| 2 | Loan Detail | `src/app/(app)/loans/[id]/page.tsx` | Replace MOCK_LOANS + wire 5 action endpoints |
| 3 | New Loan Application | `src/app/(app)/loans/new/page.tsx` | Replace 3 mock data sources + wire create |
| 4 | Audit Trail | `src/app/(app)/audit-trail/page.tsx` | Replace MOCK_AUDIT_LOGS with API |

**Pages NOT integrable (no backend API documented):**
- Dashboard — no API in docs
- Payments — no API in docs  
- Collections — no API in docs
- Reports — no API in docs

**Also check for mock data files to clean up:**
- `src/app/(app)/borrowers/components/mock-data.ts` (or similar)
- `src/app/(app)/borrowers/[id]/_components/mock-detail-data.ts` (or similar)

---

## Important Notes for Implementation

1. **Read AGENTS.md first** — This Next.js version has breaking changes. Check `node_modules/next/dist/docs/` before writing code.
2. **Service layer is ready** — All services exist in `src/services/` with correct types. Import from `@/services`.
3. **Types are ready** — All types exist in `src/types/`. Import from `@/types`.
4. **API client handles auth** — `src/lib/api-client.ts` handles Bearer tokens and refresh. No auth logic needed in pages.
5. **Pattern to follow** — Look at `src/app/(app)/borrowers/page.tsx` and `src/app/(app)/users/page.tsx` for the established pattern of how real API calls are done (useEffect + try/catch + loading state).
6. **Toast notifications** — Use `import { toast } from "sonner"` for success/error feedback on actions (already used in existing integrated pages).
7. **Keep all UI/styling exactly the same** — Only change the data layer. Do not modify component structure, styling, or layout.

---

### Task 1: Borrower Detail Page

**Files:**
- Modify: `src/app/(app)/borrowers/[id]/page.tsx`
- Check/remove: mock data imports from `../components/mock-data` and `./_components/mock-detail-data`

**What to change:**
- Remove imports of `INITIAL_BORROWERS`, `MOCK_LOANS`, `MOCK_PAYMENTS`, `MOCK_CO_MAKERS`
- Add `useEffect` to fetch data on mount:
  - `borrowerService.detail(id)` → borrower state
  - `coMakerService.list(id)` → coMakers state
  - `loanService.list({ borrower_id: id })` → loans (use the documented borrower_id filter on GET /loans)
  - `borrowerService.payments(id)` → payments (service method exists, endpoint `/borrowers/{id}/payments`)
- Add loading state (boolean) and error state
- Show loading skeleton/spinner while fetching
- Wire co-maker CRUD handlers to real API:
  - `handleAddCoMaker` → `coMakerService.create(borrowerId, data)` then refresh list
  - `handleEditCoMaker` → `coMakerService.update(id, data)` then refresh list
  - `handleDeleteCoMaker` → `coMakerService.delete(id)` then refresh list
- Add toast notifications for co-maker actions
- If payments endpoint fails (not in API docs), gracefully show empty state

- [ ] Step 1: Read the current file and the existing integrated pages (borrowers/page.tsx) to understand the exact pattern
- [ ] Step 2: Remove all mock data imports and constants
- [ ] Step 3: Add state variables for loading, error, and data (borrower, loans, payments, coMakers)
- [ ] Step 4: Add useEffect with API calls to fetch all data on mount
- [ ] Step 5: Add loading/error UI (follow existing patterns in the codebase)
- [ ] Step 6: Wire co-maker handlers to real API calls with toast notifications
- [ ] Step 7: Verify the page renders correctly with the API data shape

---

### Task 2: Loan Detail Page

**Files:**
- Modify: `src/app/(app)/loans/[id]/page.tsx`

**What to change:**
- Remove the entire `MOCK_LOANS` array (~280 lines of mock data) and `ACTING_USER` constant
- Add `useEffect` to fetch loan: `loanService.detail(id)` → loan state
- Add loading/error states
- Wire all 5 action handlers to real API:
  - `handleSubmitForReview` → `loanService.submit(id)` — returns updated Loan
  - `handleApprove` → `loanService.approve(id, { approval_remarks })` — returns updated Loan
  - `handleReject` → `loanService.reject(id, { approval_remarks: rejectionRemarks })` — returns updated Loan
  - `handleRelease` → `loanService.release(id)` — returns updated Loan (backend generates account number + schedule)
- After each action: update loan state with the returned Loan object, close dialog, show toast
- For amortization schedule display on released loans:
  - Use `loanService.amortizationPreview(id)` for the release dialog preview
  - Use `loanService.schedule(id)` for the stored schedule display (after release)
  - Fallback: keep client-side `generateSchedule()` if backend schedule endpoint is not available
- Remove client-side loan account number generation (backend handles this on release)
- Remove `ACTING_USER` — backend knows the authenticated user

- [ ] Step 1: Read the current file to understand exact mock data locations and handler logic
- [ ] Step 2: Remove MOCK_LOANS array and ACTING_USER constant
- [ ] Step 3: Add useEffect with loanService.detail(id) + loading/error states
- [ ] Step 4: Wire handleSubmitForReview to loanService.submit(id)
- [ ] Step 5: Wire handleApprove to loanService.approve(id, data)
- [ ] Step 6: Wire handleReject to loanService.reject(id, data)
- [ ] Step 7: Wire handleRelease to loanService.release(id) — remove client-side account number generation
- [ ] Step 8: Wire schedule display — try loanService.schedule(id) for released loans, fallback to client-side generation
- [ ] Step 9: Add toast notifications for all actions
- [ ] Step 10: Verify the page renders and all workflow transitions work

---

### Task 3: New Loan Application Page

**Files:**
- Modify: `src/app/(app)/loans/new/page.tsx`

**What to change:**
- Remove `MOCK_BORROWERS`, `MOCK_CO_MAKERS`, `MOCK_PRODUCTS`, `APPLICATION_NUMBER`
- Add `useEffect` to fetch dropdown data on mount:
  - `borrowerService.list()` → borrowers for dropdown (use .data from PaginatedResponse)
  - `loanProductService.list()` → products for dropdown
- When borrower is selected, fetch their co-makers:
  - `coMakerService.list(borrowerId)` → coMakers state (in a second useEffect depending on borrowerId)
- Wire submit handler to real API:
  - `loanService.create(data)` with payload matching POST /loans docs:
    ```
    { borrower_id, co_maker_ids, loan_product_id, principal_amount, interest_rate, start_date, deductions }
    ```
  - On success: show toast + redirect to `/loans` or `/loans/{newId}`
  - On error (422): show validation errors from response
- Keep client-side amortization preview (it's a calculator, doesn't need backend)
- Remove APPLICATION_NUMBER constant — backend generates it

- [ ] Step 1: Read the current file to understand the mock data shape and form submission logic
- [ ] Step 2: Remove all mock data constants
- [ ] Step 3: Add useEffect to fetch borrowers and loan products on mount
- [ ] Step 4: Add useEffect to fetch co-makers when borrowerId changes
- [ ] Step 5: Wire handleSubmit to loanService.create(data) with proper payload mapping
- [ ] Step 6: Add loading states for dropdowns and submit button
- [ ] Step 7: Handle API validation errors (422) and show in form
- [ ] Step 8: Add success redirect after loan creation

---

### Task 4: Audit Trail Page

**Files:**
- Modify: `src/app/(app)/audit-trail/page.tsx`

**What to change:**
- Remove `MOCK_AUDIT_LOGS` array (~20 items of hardcoded data)
- Add `useEffect` to fetch: `auditService.list(params)` → logs state
- Params from API docs: `{ user_id, action, auditable_type, date_from, date_to, per_page }`
- Map frontend filters to API params:
  - `search` → may not be a backend param, could filter client-side or check if API supports it
  - `moduleFilter` → `auditable_type` param
  - `actionFilter` → `action` param
- Add pagination support (API returns PaginatedResponse)
- Update summary cards to use real data:
  - Total Events: use `meta.total` from paginated response
  - Today/Active Users/Critical Actions: compute from fetched data or add dedicated API params
- Add loading state while fetching
- Re-fetch when filters change (debounced or on explicit apply)

- [ ] Step 1: Read the current file to understand mock data structure and filtering logic
- [ ] Step 2: Remove MOCK_AUDIT_LOGS constant
- [ ] Step 3: Add state for logs, loading, pagination meta
- [ ] Step 4: Add useEffect to fetch auditService.list(params) with filter params
- [ ] Step 5: Update summary cards to use real counts
- [ ] Step 6: Add pagination controls if needed (or increase per_page)
- [ ] Step 7: Verify filters trigger re-fetch and results update correctly

---

### Task 5: Cleanup Mock Data Files

**Files:**
- Check and remove if no longer imported:
  - `src/app/(app)/borrowers/components/mock-data.ts` (or `.tsx`)
  - `src/app/(app)/borrowers/[id]/_components/mock-detail-data.ts` (or `.tsx`)
  - Any other mock data files that were only used by the pages we modified

- [ ] Step 1: Search for all mock data file imports across the codebase
- [ ] Step 2: Remove files that are no longer imported by any component
- [ ] Step 3: Verify no import errors after cleanup
