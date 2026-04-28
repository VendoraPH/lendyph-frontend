# Frontend API Needs — Backend Requirements

> **Audience:** Backend developer
> **Source:** Audit of `lendyph-web` (Next.js frontend) on `development` branch, 2026-04-13
> **Purpose:** Inventory of every API method the frontend currently needs but does not yet have, plus enhancements to existing endpoints. Use this to know exactly what to build/extend on the backend side.

---

## Priority Summary

| # | Item | Impact | Effort |
|---|---|---|---|
| 1 | **Wire up Dashboard endpoints to return real data** | 🔴 High — dashboard is 100% mocked | Low (endpoints already exist, just need real implementation) |
| 2 | **Server-side pagination + filters on list endpoints** | 🔴 High — full table fetched on every page load | Medium |
| 3 | **`PUT /api/borrowers/{id}` missing fields** (`barangay`, `city`, `province`, `pledge_amount`, `street_address`, `force`) | 🔴 High — edits silently drop these | Low |
| 4 | **Repayment query by borrower** (`GET /repayments?borrower_id=X`) | 🟡 Medium — borrower detail uses mock data | Low |
| 5 | **Report preview returns real data, not samples** | 🟡 Medium — preview hardcoded in frontend | Medium |
| 6 | **Audit log export endpoint** (`GET /api/audit-logs/export`) | 🟡 Medium — UI button exists, no handler | Low |
| 7 | **Bulk borrower operations** | 🟢 Low — currently looped client-side | Low |
| 8 | **Repayment allocation validation/calculation endpoint** | 🟢 Low — complex logic done in client | Medium |
| 9 | **Field-name consistency on loan products** | 🟢 Low — workaround helper exists | Low |
| 10 | **Clarify `address` vs `street_address` on borrowers** | 🟢 Low — frontend sends both for safety | Low |

---

## 1. Dashboard — `0% integrated` 🔴

**Where:** `src/app/(app)/dashboard/page.tsx`

The dashboard page is the headline KPI screen and is **entirely backed by hardcoded mock data**. The `dashboardService` exists in `src/services/` but is never imported.

### Endpoints needed (already in swagger but unverified backend implementation)

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/dashboard/stats` | `{ total_portfolio: number, active_loans: number, total_collected: number, overdue_count: number, share_capital_total: number, ... }` |
| `GET` | `/api/dashboard/collections-trend?period=week\|month\|year` | `{ period_label: string, value: number }[]` |
| `GET` | `/api/dashboard/daily-dues?date=YYYY-MM-DD` | `{ borrower: string, loan_id: number, amount_due: number, amount_paid: number, status: "paid"\|"partial"\|"overdue" }[]` |
| `GET` | `/api/dashboard/recent-transactions?limit=10` | `{ id: number, name: string, description: string, amount: number, date: string, type: "release"\|"repayment" }[]` |

**Action for backend:** Confirm these return real DB-backed data (not stubs), then frontend will replace mock data.

---

## 2. Pagination + Filters on List Endpoints 🔴

The frontend currently fetches the **entire table** for every list page and filters client-side. This breaks at scale.

### Pages affected

| Frontend page | Endpoint | Filters frontend uses (locally) | Suggested query params |
|---|---|---|---|
| `/borrowers` | `GET /api/borrowers` | `search`, `status` (active/inactive/blacklisted), pagination (10/20/50) | `?search=&status=&page=&per_page=` |
| `/loans` | `GET /api/loans` | `search`, `status` (draft/for_review/approved/rejected/released/ongoing/completed) | `?search=&status=&page=&per_page=` |
| `/users` | `GET /api/users` | `search`, `status` | `?search=&status=&page=&per_page=` |
| `/payments/history` | `GET /api/repayments` | status tabs | `?status=&page=&per_page=` |
| `/audit-trail` | `GET /api/audit-logs` | `module`/`auditable_type`, `action`, `search`, date range | `?search=&action=&auditable_type=&date_from=&date_to=&page=&per_page=` |

### Required behavior

- Accept `page` (default 1) and `per_page` (default 20)
- Return paginated envelope: `{ data: T[], meta: { current_page, last_page, per_page, total } }`
- Search should match against multiple relevant fields (name, code, contact, etc.) using `LIKE` or fuzzy match
- Status filter accepts the exact enum value used on the frontend

---

## 3. Borrowers — `PUT /api/borrowers/{id}` Missing Fields 🔴

**Issue:** PUT schema accepts only 18 of the 24 POST fields, so users cannot edit certain things after creation.

### Add to PUT schema

| Field | Type | Why |
|---|---|---|
| `street_address` | string | Address correction (also unclear vs `address` — see #10) |
| `barangay` | string | Address correction |
| `city` | string | Address correction |
| `province` | string | Address correction |
| `pledge_amount` | number | Adjust share capital pledge |
| `force` | boolean | Override server-side duplicate detection |

These fields already exist on POST. Please mirror the schema.

---

## 4. Borrower Payments / Repayment Filter 🟡

**Where:** `src/app/(app)/borrowers/[id]/page.tsx` and `src/app/(app)/borrowers/[id]/_components/mock-detail-data.ts`

The "Payments" tab on the borrower detail page currently shows hardcoded `MOCK_PAYMENTS` (filtered locally by borrower_id).

### Need

Either of the following:

**Option A (preferred — extend existing endpoint):**
```
GET /api/repayments?borrower_id=:id&page=&per_page=
```

**Option B (new dedicated endpoint):**
```
GET /api/borrowers/:id/payments?page=&per_page=
```

Returns: `PaginatedResponse<Repayment>` with the same shape as `/api/repayments`.

---

## 5. Reports — Preview Endpoints Return Real Data 🟡

**Where:** `src/app/(app)/reports/page.tsx`

The reports page calls real endpoints (`/api/reports/daily-collection`, etc.) but the **preview pane** inside the page still uses a hardcoded `getSamplePreview()` helper instead of the API response. Some reports also have **no endpoint mapping** at all and silently fall back to `repayments()`:

| Report | Has working endpoint? |
|---|---|
| Daily Collection | ✅ Yes |
| Portfolio Summary | ✅ Yes (`loan-balance-summary`) |
| Disbursement | ✅ Yes |
| **Income** | ❌ Falls back to repayments |
| **Aging** | ❌ Falls back to repayments |
| **Borrower** | ❌ Falls back to repayments |

### Need

1. Confirm `GET /api/reports/income`, `/aging`, `/borrowers` exist and return data shaped like:
   ```json
   {
     "title": "Income Report",
     "period": { "from": "2026-01-01", "to": "2026-04-13" },
     "rows": [{ "label": "Interest Income", "value": 152000 }],
     "totals": { "gross": 200000, "net": 180000 }
   }
   ```
2. Frontend will then drop `getSamplePreview()` and render server-returned rows.

---

## 6. Audit Log Export 🟡

**Where:** `src/app/(app)/audit-trail/page.tsx`

There is an "Export" button in the audit-trail header with `onClick={() => {}}` (no handler). No service method exists.

### Need

```
GET /api/audit-logs/export?format=csv|xlsx&search=&action=&auditable_type=&date_from=&date_to=
```

Returns: streamed CSV/XLSX file with the same columns the table shows (timestamp, user, action, target, IP, changes JSON).

---

## 7. Bulk Borrower Operations 🟢

**Where:** `src/app/(app)/borrowers/page.tsx`

The borrowers list has multi-select with two bulk actions: **Deactivate Selected** and **Delete Selected**. The frontend currently does:

```ts
await Promise.all(ids.map((id) => borrowerService.deactivate(id)));
```

This is N round-trips per bulk action. For larger selections this is slow and not transactional.

### Need (optional but recommended)

```
PATCH /api/borrowers/bulk-deactivate    body: { ids: number[] }
DELETE /api/borrowers/bulk               body: { ids: number[] }
```

Returns: `{ deactivated: number[], failed: { id: number, reason: string }[] }`.

---

## 8. Repayment Allocation Calculation 🟢

**Where:** `src/app/(app)/payments/page.tsx`

Recording a payment requires splitting the amount across penalty → interest → principal → SCB → next-period buckets. The frontend computes this entirely client-side, which is fragile and creates risk of frontend/backend disagreement.

### Need (optional but strongly recommended)

```
POST /api/loans/:id/repayments/preview
body: { amount: number, payment_date: string }
returns: {
  allocated_to_penalty: number,
  allocated_to_interest: number,
  allocated_to_principal: number,
  allocated_to_scb: number,
  excess_to_next_period: { interest: number, principal: number },
  resulting_balance: number,
  resulting_status: "current" | "overdue" | "completed"
}
```

Frontend would call this on amount-input change to display the breakdown, then submit the actual payment using the existing `POST /api/loans/:id/repayments`.

---

## 9. Loan Product Field Naming 🟢

**Where:** `src/app/(app)/settings/loan-products/page.tsx`

The frontend type expects: `interest_type`, `payment_frequency`, `min_term`, `grace_period`.
The API returns: `interest_method`, `frequency`, `term`, `grace_period_days`.

The frontend currently has a `getProductField()` helper to bridge the two. Please pick one canonical naming and document it; the frontend will then drop the helper.

---

## 10. POST Borrower — `address` vs `street_address` 🟢

**Where:** `src/app/(app)/borrowers/new/page.tsx`

POST `/api/borrowers` accepts both `address` and `street_address`. The frontend has only one "Street Address" input. To be safe, the frontend currently sends the input value into **both** fields. We need clarification:

- **Option A:** Drop `address` from the schema. Frontend will send only `street_address`.
- **Option B:** Keep both. Tell us what `address` represents (full composed string?) and we'll generate it from the structured parts (street + barangay + city + province).

---

## 11. Dead-Code Service Methods (for cleanup tracking)

These service methods were defined but the corresponding UI feature was never built. Either build the feature or leave them as TODOs:

| Method | Endpoint | What's missing |
|---|---|---|
| `borrowerService.deletePhoto()` | `DELETE /api/borrowers/{id}/photo` | No "remove photo" UI |
| `documentService.detail()` | `GET /api/documents/{id}` | UI only fetches lists |
| `loanDocumentService.disclosure()` | `GET /api/loans/{loan}/disclosure` | Frontend uses local template |
| `loanDocumentService.promissoryNote()` | `GET /api/loans/{loan}/promissory-note` | Frontend uses local template |
| `systemService.health()` | `GET /api/health` | No status page |

**Decision needed for loan documents:** Should the frontend stop using local templates and fetch from `/disclosure` and `/promissory-note` instead? If so, the backend must produce identical layouts. If not, please remove those endpoints to avoid confusion.

---

## 12. Fees — Entire Domain Has No UI 🟢

**Where:** Nowhere — there is no fees management page in the frontend.

The backend has 5 fee endpoints (`GET/POST /api/fees`, `GET/PUT/DELETE /api/fees/{id}`) and `feeService` exists in the frontend but is never imported. Either:
- **Build a `/settings/fees` management page** on the frontend (let us know if this is on the roadmap), or
- **Remove the fee endpoints** if fees are intended to live inside loan products.

---

## 13. Loan Status — New `current` and `past_due` States + Product Config 🔴

**Where:** `src/types/loan.ts`, `src/constants/index.ts`, `src/app/(app)/loans/page.tsx`, `src/app/(app)/settings/loan-products/page.tsx`

ClickUp ticket [86d2n5yt3]. The frontend now accepts and renders two new loan statuses and exposes a new Loan Product config. Backend needs to implement the transitions:

### New statuses
- `current` — a released loan on the day **after** release, while all installments are on-time (or within the grace period of their due date).
- `past_due` — a released loan where at least one installment has gone past grace *and* past the product's **Past Due Transfer** threshold.

Expected state machine (backend owns these):
```
released  (release day only)
   ↓  (next day)
current
   ↓  (payment missed + grace expires + past_due_transfer threshold reached)
past_due
   ↓  (all installments paid)
completed
```

The legacy `ongoing` status should be deprecated in favor of `current`. Frontend still accepts `ongoing` from older responses for backward compat, but all newly-persisted loans should use `current`.

### New LoanProduct fields
```
past_due_transfer_value: integer (optional, positive)
past_due_transfer_unit:  enum (optional) — "days" | "months" | "amortization_periods"
```

Both are sent from the loan product create/update form. Blank means "use backend default" (pick whichever makes sense).

Please accept these on `POST /api/loan-products` and `PUT /api/loan-products/{id}`, return them on `GET /api/loan-products` and `GET /api/loan-products/{id}`, and use them when computing the status transition.

---

## 14. Computed Aggregations the Frontend Builds Locally

These are derived client-side by iterating over the entire dataset. Once pagination is enabled (#2) the client will no longer have the full dataset, so the backend will need to return these in the list response or as a separate stats endpoint.

| Computation | Currently | Needed |
|---|---|---|
| Borrower status counts (active/inactive/blacklisted) | Client loop | Include in `/borrowers` list response meta, or `GET /borrowers/stats` |
| Loan status counts (draft/for_review/etc.) | Client loop | Include in `/loans` list response meta, or `GET /loans/stats` |
| User active/inactive counts | Client loop | Include in `/users` list response meta |

**Suggested response envelope:**
```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 20,
    "total": 87,
    "stats": { "active": 60, "inactive": 22, "blacklisted": 5 }
  }
}
```

---

## Recap — Endpoints to ADD

| Method | Path | Priority |
|---|---|---|
| `GET` | `/api/repayments?borrower_id=X` (extend existing endpoint with filter) | 🟡 |
| `GET` | `/api/audit-logs/export` | 🟡 |
| `PATCH` | `/api/borrowers/bulk-deactivate` | 🟢 |
| `DELETE` | `/api/borrowers/bulk` | 🟢 |
| `POST` | `/api/loans/:id/repayments/preview` | 🟢 |

## Recap — Endpoints to EXTEND

| Method | Path | What to add |
|---|---|---|
| `PUT` | `/api/borrowers/{id}` | Add `street_address`, `barangay`, `city`, `province`, `pledge_amount`, `force` |
| `GET` | `/api/borrowers` | Server-side `search`, `status`, `page`, `per_page`, stats meta |
| `GET` | `/api/loans` | Server-side `search`, `status`, `page`, `per_page`, stats meta |
| `GET` | `/api/users` | Server-side `search`, `status`, `page`, `per_page` |
| `GET` | `/api/audit-logs` | Server-side `search`, `action`, `auditable_type`, date range |
| All `/api/dashboard/*` | (already exist) | Confirm they return real DB-backed data, not stubs |
| All `/api/reports/*` | (already exist) | Confirm income/aging/borrower exist and return structured rows |

## Recap — Decisions Needed (no code change yet)

- `address` vs `street_address` on borrowers (#10)
- Loan product field naming canonical (#9)
- Loan document generation: backend or local templates? (#11)
- Fees management: build UI or remove endpoints? (#12)
