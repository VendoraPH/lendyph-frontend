# GCash Transactions — Design Spec

**Date:** 2026-05-17
**Status:** Approved for implementation
**Source:** SharePoint task brief (RBT Bank MIS) pasted into chat

---

## 1. Goal

Let cashiers record GCash Cash In / Cash Out transactions made on behalf of members, charge a tiered fee, defer income recognition for unpaid Cash Ins, and report Total Income + Pending Payments.

## 2. Approved decisions

| Decision | Resolution |
|---|---|
| Total Amount math | Cash In total = `Amount + Charge` (member pays more). Cash Out total = `Amount − Charge` (member receives less). Coop earns the charge in both. |
| Navigation | New **top-level** sidebar item **GCash** between *Collateral* and *User Management*. Page has three tabs (Members, Transactions, Reports). Tab state in `?tab=`. |
| Tier rate type | **Flat peso per tier** (not percentage). |
| Pending Payment | Cash In only. Means: member received GCash on credit, owes the cash. `[Paid]` button finalizes when cash is collected. Income deferred until paid. |
| Reports placement | Third tab on `/gcash` page. |
| Settings page | `/settings/gcash` (new entry in Settings nav). |

## 3. Routes & permissions

```
src/app/(app)/gcash/page.tsx              # Members / Transactions / Reports tabs
src/app/(app)/settings/gcash/page.tsx     # Tiered charges editor
```

Add to `src/constants/navigation.ts`:
- `SIDEBAR_NAV` — new entry `{ title: "GCash", href: "/gcash", icon: Smartphone, permission: "gcash:view" }` between Collateral and User Management.
- Settings children — append `{ title: "GCash", href: "/settings/gcash" }`.

Add to `Permission` union in `src/types/index.ts`:
- `gcash:view` — see menu and read transactions
- `gcash:transact` — create transactions; mark Pending → Paid
- `gcash:settings` — edit tier table

Default role mapping: admin gets all three; cashier role gets `view` + `transact`. Permission seeding is a backend concern — handoff section calls it out.

## 4. Frontend data model — `src/types/gcash.ts`

```ts
export type GCashTransactionType = "cash_in" | "cash_out";
export type GCashTransactionStatus = "pending" | "paid" | "completed";
// pending/paid apply to cash_in only; cash_out is always "completed"

export interface GCashTransaction {
  id: number;
  reference_no: string;
  transaction_date: string;        // ISO datetime
  type: GCashTransactionType;
  amount: number;
  charge_amount: number;           // frozen on row at creation time
  total_amount: number;
  status: GCashTransactionStatus;
  borrower_id: number;
  borrower?: { id: number; full_name: string; borrower_code: string };
  transactor_user_id: number;
  transactor_user?: { id: number; full_name: string };
  remarks?: string | null;
  paid_at?: string | null;
  paid_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GCashTier {
  id: number;
  min_amount: number;
  max_amount: number;
  cash_in_rate: number;            // flat peso
  cash_out_rate: number;           // flat peso
  display_order: number;
}

export interface GCashIncomeReport {
  start_date: string;
  end_date: string;
  total_income: number;
  cash_in_count: number;
  cash_out_count: number;
}

export interface GCashPendingItem {
  id: number;
  reference_no: string;
  transaction_date: string;
  borrower: { id: number; full_name: string; borrower_code: string };
  amount: number;
  charge_amount: number;
  total_amount: number;
  days_pending: number;            // server-computed
}
```

Notes:
- `charge_amount` is **frozen** on the row at create time — later tier edits do not retroactively change historical rows.
- `reference_no` is backend-generated.
- `transactor_user` is the staff member who recorded the transaction; `borrower` is the GCash recipient.

## 5. Service layer — `src/services/gcash.service.ts`

```ts
export const gcashService = {
  // Transactions
  listTransactions: (params?: {
    type?: GCashTransactionType;
    status?: GCashTransactionStatus | "pending_only";
    start_date?: string;
    end_date?: string;
    borrower_id?: number;
    page?: number; per_page?: number;
  }) => api.get<PaginatedResponse<GCashTransaction>>("/gcash/transactions", { params }),

  createTransaction: (data: {
    borrower_id: number;
    type: GCashTransactionType;
    amount: number;
    is_pending?: boolean;          // cash_in only
    remarks?: string;
  }) => api.post<GCashTransaction>("/gcash/transactions", data),

  markPaid: (id: number) =>
    api.patch<GCashTransaction>(`/gcash/transactions/${id}/paid`),

  // Tiers
  listTiers: () => api.get<GCashTier[]>("/gcash/tiers"),
  upsertTiers: (tiers: Omit<GCashTier, "id">[]) =>
    api.put<GCashTier[]>("/gcash/tiers", { tiers }),  // full replace

  // Reports
  incomeReport: (start_date: string, end_date: string) =>
    api.get<GCashIncomeReport>("/gcash/reports/income", {
      params: { start_date, end_date }
    }),
  pendingList: () =>
    api.get<GCashPendingItem[]>("/gcash/reports/pending"),
};
```

Member listing reuses existing `borrowerService.list()` — no new endpoint.

## 6. Components & files

```
src/app/(app)/gcash/
  page.tsx                          # tab router (Members | Transactions | Reports)
  _components/
    members-tab.tsx                 # search + table with [Cash In] [Cash Out] per row
    transactions-tab.tsx            # filters + paginated table
    reports-tab.tsx                 # Total Income card + Pending Payments table
    cash-in-dialog.tsx              # form: amount, auto-charge, total, pending checkbox, remarks
    cash-out-dialog.tsx             # form: amount, auto-charge, total, remarks
    paid-button.tsx                 # confirms then calls markPaid
src/app/(app)/settings/gcash/
  page.tsx                          # tier editor (add/remove rows, save replaces all)
src/hooks/
  use-gcash-tiers.ts                # SWR-like cache; provides resolveCharge(amount, type)
src/services/
  gcash.service.ts                  # as above
src/types/
  gcash.ts                          # as above (exported through src/types/index.ts)
```

`use-gcash-tiers` exposes:
```ts
function useGCashTiers(): {
  tiers: GCashTier[];
  loading: boolean;
  resolveCharge(amount: number, type: GCashTransactionType): number | null;
  refresh(): void;
};
```
`resolveCharge` returns `null` (and the dialog blocks the OK button) when no tier matches the amount.

## 7. UX flow

**Cash In flow**
1. Cashier opens `/gcash` → Members tab.
2. Finds member → clicks **Cash In** on that row.
3. `CashInDialog` opens with the member name fixed at the top.
4. Cashier types Amount → `resolveCharge` computes Charge (read-only); Total = Amount + Charge (read-only).
5. Optional: checks "Pending Payment" + adds remarks.
6. Clicks OK → `gcashService.createTransaction({ borrower_id, type: "cash_in", amount, is_pending, remarks })`.
7. Backend returns the transaction with reference_no; toast shows `Reference: <ref_no>`.
8. Transactions tab refreshes; new row appears.

**Cash Out flow**: Identical except no Pending checkbox and total math is subtraction.

**Mark Paid flow**
1. On Transactions tab (or Reports → Pending list), Cash In rows with `status === "pending"` show a **Paid** button.
2. Click → small confirm dialog → `gcashService.markPaid(id)`.
3. Row's status flips to `paid`; included in next income report.

**Reports tab**
- *Total Income card*: date range pickers (default = current month) → `gcashService.incomeReport(start, end)` → big total + counts.
- *Pending Payments table*: `gcashService.pendingList()` → columns: Date, Ref, Member, Amount, Charge, Total, Days Pending, [Paid] action.

**Settings — Tiered Charges**
- `/settings/gcash` shows table of tier rows (Min, Max, Cash In Rate, Cash Out Rate, Order) with `+` to add and `×` to remove.
- Validation: `min_amount > 0`, `max_amount > min_amount`, tiers must not overlap, must be contiguous in display_order. Errors shown inline.
- Save calls `upsertTiers` with the full array (full-replace pattern — simpler than diffing on the frontend).

## 8. Error handling

- All service calls wrapped in `try/catch` with `toast.error()` surfacing the server's `errors[*]` or `message` (same pattern used by `extendErrorMessage` in `loans/[id]/page.tsx`).
- Specific friendly mappings:
  - `422` no tier matches amount → "No tier covers this amount. Update GCash settings."
  - `409` duplicate transaction within 1 minute → "Looks like a duplicate — last similar transaction was X seconds ago. Continue?"
  - `403` → "You don't have permission to record GCash transactions."

## 9. Testing approach

- Type-check via `tsc --noEmit` before each commit (project standard).
- Manual test plan:
  - Create tier `1–1500: in 20 / out 15`; create Cash In 1,000 → row shows 1,000 + 20 = 1,020.
  - Create Cash Out 3,000 with tier `1501–5000: in 50 / out 200` → row shows 3,000 − 200 = 2,800.
  - Create Cash In 800 with Pending checked → Reports → Pending Payments lists it with days_pending = 0; Total Income excludes it.
  - Click [Paid] → row flips, Total Income now includes the 20.
  - Edit tier rates → existing rows unchanged.

## 10. Backend gap — handoff message

**No GCash endpoints exist in the Lendyph Swagger spec yet.** The backend dev needs to build everything below. A copy-paste-ready handoff message is generated separately in the chat at implementation time (per the project's `swagger-backend-handoff` workflow).

Endpoints required:

| # | Method + Path | Purpose |
|---|---|---|
| 1 | `GET /api/gcash/transactions` | Paginated list, filterable by `type`, `status`, `start_date`, `end_date`, `borrower_id` |
| 2 | `POST /api/gcash/transactions` | Create; computes charge_amount from active tiers, generates `reference_no`, sets `transactor_user_id` from auth, sets status `pending` (if `is_pending` and cash_in) else `paid`/`completed` |
| 3 | `PATCH /api/gcash/transactions/{id}/paid` | Flip a pending cash_in to `paid`; sets `paid_at` and `paid_by_user_id` |
| 4 | `GET /api/gcash/tiers` | Read tier table |
| 5 | `PUT /api/gcash/tiers` | Full-replace tier table; validates non-overlapping ranges |
| 6 | `GET /api/gcash/reports/income?start_date&end_date` | Sum of `charge_amount` where `status != pending`, plus per-type counts |
| 7 | `GET /api/gcash/reports/pending` | Cash_in transactions where `status = pending`; each item includes server-computed `days_pending` |

Permissions to seed: `gcash:view`, `gcash:transact`, `gcash:settings`.

## 11. Out of scope (deferred)

- Editing or voiding GCash transactions (no spec requirement; if a wrong entry happens, mark + remarks for now).
- Audit-trail integration of GCash transactions — backend should still write to `audit_logs` table but the frontend doesn't need a custom view.
- CSV export of transactions/reports — not in spec.
- Refunds, reversals.
- GCash-to-loan payment shortcuts (mixing modules).
