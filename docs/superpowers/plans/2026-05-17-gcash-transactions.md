# GCash Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a frontend GCash Transactions module — sidebar entry, three-tab page (Members / Transactions / Reports), tiered charges settings page, and a Cash In / Cash Out workflow with deferred income recognition for pending Cash Ins.

**Architecture:** Standard Lendyph frontend stack. New types in `src/types/gcash.ts`, services in `src/services/gcash.service.ts`, route group pages under `src/app/(app)/gcash/` and `src/app/(app)/settings/gcash/`. A `useGCashTiers` hook owns tier caching + `resolveCharge()`. All write operations go through `gcashService`. Backend endpoints will be added separately — the handoff is generated in the chat at implementation time.

**Tech Stack:** Next.js 16.2.1 (Turbopack), React 19, TypeScript strict, shadcn/ui (Table, Dialog, AlertDialog, Tooltip), Tailwind, lucide-react icons, axios via `src/lib/api-client.ts`, project's `RouteGuard` for permission gating, `sonner` for toasts.

**Spec reference:** `docs/superpowers/specs/2026-05-17-gcash-transactions-design.md`

**Branch:** `feat/gcash-transactions` (off `development`, already created).

**Commit cadence:** One commit per task. Type-check (`pnpm exec tsc --noEmit`) before each commit. Conventional commits with `feat(gcash):` / `chore(gcash):` prefix.

---

## File map

**New files**

```
src/types/gcash.ts                                   # data model (§4 of spec)
src/services/gcash.service.ts                        # API service layer (§5 of spec)
src/hooks/use-gcash-tiers.ts                         # tier cache + resolveCharge
src/lib/gcash-errors.ts                              # error message mapper
src/app/(app)/gcash/page.tsx                         # tab router
src/app/(app)/gcash/_components/members-tab.tsx
src/app/(app)/gcash/_components/transactions-tab.tsx
src/app/(app)/gcash/_components/reports-tab.tsx
src/app/(app)/gcash/_components/cash-in-dialog.tsx
src/app/(app)/gcash/_components/cash-out-dialog.tsx
src/app/(app)/gcash/_components/paid-button.tsx
src/app/(app)/settings/gcash/page.tsx                # tier editor
```

**Modified files**

```
src/types/rbac.ts                                    # add "gcash" Module + "transact"/"settings" Action
src/types/index.ts                                   # export GCash types
src/config/api-endpoints.ts                          # add GCASH endpoint block
src/constants/navigation.ts                          # add GCash sidebar entry + Settings child
```

---

## Phase 1 — Foundation (types, permissions, service)

### Task 1: Add GCash module + actions to RBAC

**Files:**
- Modify: `src/types/rbac.ts`

- [ ] **Step 1: Add `gcash` to `Module` union and `transact` / `settings` to `Action` union**

```ts
// src/types/rbac.ts
export type Module =
  | "dashboard"
  | "borrowers"
  | "loans"
  | "payments"
  | "collections"
  | "reports"
  | "settings"
  | "users"
  | "audit_logs"
  | "share_capital"
  | "collaterals"
  | "auto_pay"
  | "gcash";

export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "release"
  | "void"
  | "mark_collected"
  | "export"
  | "process"
  | "toggle"
  | "transact"
  | "settings";
```

The template-literal `Permission` type auto-derives `gcash:view`, `gcash:transact`, `gcash:settings`. No other change needed.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors). If any role-config file enumerates permissions exhaustively and the compiler flags missing entries, leave those for Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/types/rbac.ts
git commit -m "feat(gcash): add gcash module and transact/settings actions to RBAC"
```

---

### Task 2: Define GCash data model

**Files:**
- Create: `src/types/gcash.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write `src/types/gcash.ts`**

```ts
// src/types/gcash.ts
export type GCashTransactionType = "cash_in" | "cash_out";

// pending/paid apply to cash_in only; cash_out is always "completed".
export type GCashTransactionStatus = "pending" | "paid" | "completed";

export interface GCashTransaction {
  id: number;
  reference_no: string;
  transaction_date: string; // ISO datetime
  type: GCashTransactionType;
  amount: number;
  charge_amount: number; // frozen on row at creation time
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
  cash_in_rate: number;  // flat peso
  cash_out_rate: number; // flat peso
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
  days_pending: number; // server-computed
}

export interface CreateGCashTransactionData {
  borrower_id: number;
  type: GCashTransactionType;
  amount: number;
  is_pending?: boolean; // cash_in only
  remarks?: string;
}

export type GCashListFilters = {
  type?: GCashTransactionType;
  status?: GCashTransactionStatus | "pending_only";
  start_date?: string;
  end_date?: string;
  borrower_id?: number;
  page?: number;
  per_page?: number;
};

export type GCashTierInput = Omit<GCashTier, "id">;
```

- [ ] **Step 2: Re-export from `src/types/index.ts`**

Add this line at the bottom of the existing `export type` list:

```ts
export type {
  GCashTransaction,
  GCashTransactionType,
  GCashTransactionStatus,
  GCashTier,
  GCashTierInput,
  GCashIncomeReport,
  GCashPendingItem,
  CreateGCashTransactionData,
  GCashListFilters,
} from "./gcash";
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/types/gcash.ts src/types/index.ts
git commit -m "feat(gcash): add types for transactions, tiers, and reports"
```

---

### Task 3: Add GCash endpoints to config

**Files:**
- Modify: `src/config/api-endpoints.ts`

- [ ] **Step 1: Add GCASH block**

Append inside the `API_ENDPOINTS` object (preserve alphabetical-ish grouping — place after the closest existing module like `COLLATERALS` or `COLLECTIONS`):

```ts
GCASH: {
  TRANSACTIONS_LIST: "/gcash/transactions",
  TRANSACTIONS_CREATE: "/gcash/transactions",
  TRANSACTIONS_MARK_PAID: (id: number) => `/gcash/transactions/${id}/paid`,
  TIERS_LIST: "/gcash/tiers",
  TIERS_UPSERT: "/gcash/tiers",
  REPORTS_INCOME: "/gcash/reports/income",
  REPORTS_PENDING: "/gcash/reports/pending",
},
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/config/api-endpoints.ts
git commit -m "feat(gcash): register backend endpoints in api-endpoints"
```

---

### Task 4: Service layer

**Files:**
- Create: `src/services/gcash.service.ts`

- [ ] **Step 1: Write the service**

```ts
// src/services/gcash.service.ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  GCashTransaction,
  GCashTier,
  GCashTierInput,
  GCashIncomeReport,
  GCashPendingItem,
  CreateGCashTransactionData,
  GCashListFilters,
  PaginatedResponse,
} from "@/types";

export const gcashService = {
  // ---------- Transactions ----------
  listTransactions: (params?: GCashListFilters) =>
    api.get<PaginatedResponse<GCashTransaction>>(
      API_ENDPOINTS.GCASH.TRANSACTIONS_LIST,
      { params },
    ),

  createTransaction: (data: CreateGCashTransactionData) =>
    api.post<GCashTransaction>(API_ENDPOINTS.GCASH.TRANSACTIONS_CREATE, data),

  markPaid: (id: number) =>
    api.patch<GCashTransaction>(API_ENDPOINTS.GCASH.TRANSACTIONS_MARK_PAID(id)),

  // ---------- Tiers ----------
  listTiers: () =>
    api.get<GCashTier[]>(API_ENDPOINTS.GCASH.TIERS_LIST),

  upsertTiers: (tiers: GCashTierInput[]) =>
    api.put<GCashTier[]>(API_ENDPOINTS.GCASH.TIERS_UPSERT, { tiers }),

  // ---------- Reports ----------
  incomeReport: (start_date: string, end_date: string) =>
    api.get<GCashIncomeReport>(API_ENDPOINTS.GCASH.REPORTS_INCOME, {
      params: { start_date, end_date },
    }),

  pendingList: () =>
    api.get<GCashPendingItem[]>(API_ENDPOINTS.GCASH.REPORTS_PENDING),
};
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/gcash.service.ts
git commit -m "feat(gcash): add service layer for transactions, tiers, reports"
```

---

### Task 5: Sidebar + Settings nav entry

**Files:**
- Modify: `src/constants/navigation.ts`

- [ ] **Step 1: Add Smartphone icon import and GCash item**

In the lucide import block at top, add `Smartphone`:

```ts
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  UserCog,
  History,
  FilePlus,
  Package,
  Landmark,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
```

Insert the new top-level entry **between Collateral and User Management** (matches spec §2):

```ts
  {
    title: "GCash",
    href: "/gcash",
    icon: Smartphone,
    permission: "gcash:view",
  },
```

So the surrounding order becomes: `Collateral` → `GCash` → `User Management`.

- [ ] **Step 2: Add GCash entry under Settings children**

Append to the `children` array of the `Settings` nav item:

```ts
      { title: "GCash", href: "/settings/gcash" },
```

After Approval Workflow.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke check**

Run dev server: `pnpm dev`
Visit http://localhost:3000/dashboard, log in. Sidebar should show "GCash" as a top-level item between Collateral and User Management. Settings submenu should show "GCash" under Approval Workflow.
Clicking either link will 404 — expected at this point (page comes in Task 9 / Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/constants/navigation.ts
git commit -m "feat(gcash): add sidebar entry and settings nav child"
```

---

### Task 6: Tier hook with charge resolver

**Files:**
- Create: `src/hooks/use-gcash-tiers.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/use-gcash-tiers.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gcashService } from "@/services/gcash.service";
import type { GCashTier, GCashTransactionType } from "@/types";

interface UseGCashTiersResult {
  tiers: GCashTier[];
  loading: boolean;
  error: string | null;
  resolveCharge(
    amount: number,
    type: GCashTransactionType,
  ): number | null;
  refresh(): Promise<void>;
}

export function useGCashTiers(): UseGCashTiersResult {
  const [tiers, setTiers] = useState<GCashTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gcashService.listTiers();
      const list = Array.isArray(res.data) ? res.data : [];
      list.sort((a, b) => a.display_order - b.display_order);
      setTiers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tiers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void load();
  }, [load]);

  const resolveCharge = useCallback(
    (amount: number, type: GCashTransactionType): number | null => {
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const match = tiers.find(
        (t) => amount >= t.min_amount && amount <= t.max_amount,
      );
      if (!match) return null;
      return type === "cash_in" ? match.cash_in_rate : match.cash_out_rate;
    },
    [tiers],
  );

  return {
    tiers,
    loading,
    error,
    resolveCharge,
    refresh: load,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-gcash-tiers.ts
git commit -m "feat(gcash): add useGCashTiers hook with resolveCharge"
```

---

### Task 7: Error message helper

**Files:**
- Create: `src/lib/gcash-errors.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/gcash-errors.ts
import { AxiosError } from "axios";

interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

export function extractGCashErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const body = err.response?.data as ApiErrorBody | undefined;

    if (status === 422 && body?.message?.toLowerCase().includes("tier")) {
      return "No tier covers this amount. Update GCash settings.";
    }
    if (status === 409) {
      return "Looks like a duplicate — a similar transaction was just recorded. Continue?";
    }
    if (status === 403) {
      return "You don't have permission to record GCash transactions.";
    }

    if (body?.errors) {
      const firstField = Object.keys(body.errors)[0];
      const firstMsg = firstField && body.errors[firstField]?.[0];
      if (firstMsg) return firstMsg;
    }
    if (body?.message) return body.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/gcash-errors.ts
git commit -m "feat(gcash): add error message helper for friendly toasts"
```

---

## Phase 2 — Settings page (tiered charges editor)

### Task 8: Tiered charges settings page

**Files:**
- Create: `src/app/(app)/settings/gcash/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/(app)/settings/gcash/page.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteGuard } from "@/components/auth/route-guard";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashTier, GCashTierInput } from "@/types";

type Row = GCashTierInput & { tempId: string };

function makeRow(seed?: Partial<GCashTierInput>): Row {
  return {
    tempId: Math.random().toString(36).slice(2),
    min_amount: seed?.min_amount ?? 0,
    max_amount: seed?.max_amount ?? 0,
    cash_in_rate: seed?.cash_in_rate ?? 0,
    cash_out_rate: seed?.cash_out_rate ?? 0,
    display_order: seed?.display_order ?? 0,
  };
}

function validate(rows: Row[]): string | null {
  if (rows.length === 0) return null; // empty list is a valid (deletes all)
  const sorted = [...rows].sort((a, b) => a.display_order - b.display_order);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!(r.min_amount > 0)) return `Row ${i + 1}: Min amount must be > 0.`;
    if (!(r.max_amount > r.min_amount))
      return `Row ${i + 1}: Max amount must be greater than Min.`;
    if (r.cash_in_rate < 0 || r.cash_out_rate < 0)
      return `Row ${i + 1}: Rates cannot be negative.`;
    if (i > 0 && sorted[i - 1].max_amount >= r.min_amount)
      return `Row ${i + 1}: overlaps with the previous tier.`;
  }
  return null;
}

export default function GCashSettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await gcashService.listTiers();
        if (cancelled) return;
        const list: GCashTier[] = Array.isArray(res.data) ? res.data : [];
        list.sort((a, b) => a.display_order - b.display_order);
        setRows(list.map((t) => makeRow(t)));
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (tempId: string, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)),
    );

  const addRow = () => {
    const nextOrder =
      rows.length === 0
        ? 1
        : Math.max(...rows.map((r) => r.display_order)) + 1;
    setRows((prev) => [...prev, makeRow({ display_order: nextOrder })]);
  };

  const removeRow = (tempId: string) =>
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));

  const handleSave = async () => {
    const error = validate(rows);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const payload: GCashTierInput[] = rows
        .map(({ tempId: _t, ...rest }) => rest)
        .sort((a, b) => a.display_order - b.display_order);
      const res = await gcashService.upsertTiers(payload);
      const saved = Array.isArray(res.data) ? res.data : [];
      saved.sort((a, b) => a.display_order - b.display_order);
      setRows(saved.map((t) => makeRow(t)));
      toast.success("GCash tiers saved.");
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard permission="gcash:settings">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">GCash Tiered Charges</h1>
          <p className="text-sm text-muted-foreground">
            Charges are computed at transaction time based on the amount tier.
            Existing transactions are not affected when these change.
          </p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Order</TableHead>
                <TableHead>Min Amount</TableHead>
                <TableHead>Max Amount</TableHead>
                <TableHead>Cash In Rate (₱)</TableHead>
                <TableHead>Cash Out Rate (₱)</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="inline-block h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No tiers configured. Click + to add one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.tempId}>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.display_order}
                        min={1}
                        onChange={(e) =>
                          update(r.tempId, {
                            display_order: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.min_amount}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            min_amount: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.max_amount}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            max_amount: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.cash_in_rate}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            cash_in_rate: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.cash_out_rate}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            cash_out_rate: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.tempId)}
                        aria-label="Remove tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tier
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving…" : "Save Tiers"}
          </Button>
        </div>
      </div>
    </RouteGuard>
  );
}
```

> If `RouteGuard` lives at a different path in this codebase, adjust the import. The convention check is: grep `route-guard` to confirm.

- [ ] **Step 2: Confirm `RouteGuard` import path**

Run search: look for `route-guard` usage in another settings page (e.g. `src/app/(app)/settings/branches/page.tsx`) and copy that import path verbatim.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

`pnpm dev` → navigate to http://localhost:3000/settings/gcash. If the backend endpoint isn't ready, the page renders empty with the "No tiers configured" placeholder and a toast error — that's expected. Add 2 rows, click Save: a 404 or 403 toast confirms the wiring is correct, the backend just isn't built yet.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/gcash/page.tsx
git commit -m "feat(gcash): add tiered charges settings page"
```

---

## Phase 3 — GCash main page + Members tab

### Task 9: Tab-router page shell

**Files:**
- Create: `src/app/(app)/gcash/page.tsx`

- [ ] **Step 1: Write the shell**

```tsx
// src/app/(app)/gcash/page.tsx
"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RouteGuard } from "@/components/auth/route-guard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MembersTab } from "./_components/members-tab";
import { TransactionsTab } from "./_components/transactions-tab";
import { ReportsTab } from "./_components/reports-tab";

type TabKey = "members" | "transactions" | "reports";
const TABS: TabKey[] = ["members", "transactions", "reports"];

function GCashPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabKey = TABS.includes(raw as TabKey)
    ? (raw as TabKey)
    : "members";

  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/gcash?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">GCash</h1>
        <p className="text-sm text-muted-foreground">
          Record Cash In / Cash Out transactions, manage pending payments, and
          view income reports.
        </p>
      </div>

      <Tabs value={active} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
          <MembersTab />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function GCashPage() {
  return (
    <RouteGuard permission="gcash:view">
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <GCashPageContent />
      </Suspense>
    </RouteGuard>
  );
}
```

> The three tab components don't exist yet — TypeScript will error here until Tasks 10–13 land. That's OK; we'll create stub files in Step 2 to keep the type-check green.

- [ ] **Step 2: Add stub tab components so type-check passes**

```tsx
// src/app/(app)/gcash/_components/members-tab.tsx
"use client";
export function MembersTab() {
  return <div className="text-sm text-muted-foreground">Members tab coming up…</div>;
}
```

```tsx
// src/app/(app)/gcash/_components/transactions-tab.tsx
"use client";
export function TransactionsTab() {
  return <div className="text-sm text-muted-foreground">Transactions tab coming up…</div>;
}
```

```tsx
// src/app/(app)/gcash/_components/reports-tab.tsx
"use client";
export function ReportsTab() {
  return <div className="text-sm text-muted-foreground">Reports tab coming up…</div>;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

`pnpm dev` → http://localhost:3000/gcash. Verify all 3 tabs render and the URL updates `?tab=members|transactions|reports` when clicked.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/gcash/page.tsx src/app/\(app\)/gcash/_components/
git commit -m "feat(gcash): add page shell with members/transactions/reports tabs"
```

---

### Task 10: Cash In dialog

**Files:**
- Create: `src/app/(app)/gcash/_components/cash-in-dialog.tsx`

- [ ] **Step 1: Write the dialog**

```tsx
// src/app/(app)/gcash/_components/cash-in-dialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { gcashService } from "@/services/gcash.service";
import { useGCashTiers } from "@/hooks/use-gcash-tiers";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  borrower: { id: number; full_name: string; borrower_code?: string };
  onCreated?(): void;
}

export function CashInDialog({ open, onOpenChange, borrower, onCreated }: Props) {
  const { resolveCharge, loading: tiersLoading } = useGCashTiers();
  const [amount, setAmount] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setIsPending(false);
      setRemarks("");
    }
  }, [open]);

  const amountNum = Number(amount);
  const charge = useMemo(
    () =>
      Number.isFinite(amountNum) && amountNum > 0
        ? resolveCharge(amountNum, "cash_in")
        : null,
    [amountNum, resolveCharge],
  );
  const total = charge === null ? null : amountNum + charge;
  const canSubmit =
    !submitting && amountNum > 0 && charge !== null && !tiersLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await gcashService.createTransaction({
        borrower_id: borrower.id,
        type: "cash_in",
        amount: amountNum,
        is_pending: isPending,
        remarks: remarks.trim() || undefined,
      });
      toast.success(
        `Cash In recorded. Reference: ${res.data?.reference_no ?? "—"}`,
      );
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cash In — {borrower.full_name}</DialogTitle>
          <DialogDescription>
            Records a GCash Cash In on behalf of this member. Member pays{" "}
            <span className="font-medium">Amount + Charge</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cashin-amount">Amount (₱)</Label>
            <Input
              id="cashin-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            {amountNum > 0 && charge === null && (
              <p className="text-xs text-destructive">
                No tier covers this amount. Update GCash settings.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground">Charge</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {charge !== null ? formatCurrency(charge) : "—"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {total !== null ? formatCurrency(total) : "—"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="cashin-pending"
              checked={isPending}
              onCheckedChange={(v) => setIsPending(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="cashin-pending" className="font-normal">
                Pending Payment
              </Label>
              <p className="text-xs text-muted-foreground">
                Member received GCash on credit and owes the cash. Income is
                deferred until you click Paid.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cashin-remarks">Remarks (optional)</Label>
            <Textarea
              id="cashin-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Record Cash In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify `formatCurrency` import**

If `src/lib/format.ts` exports a different function name (e.g. `formatPHP` or `currency`), update the import accordingly.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/gcash/_components/cash-in-dialog.tsx
git commit -m "feat(gcash): add Cash In dialog with auto-charge resolver"
```

---

### Task 11: Cash Out dialog

**Files:**
- Create: `src/app/(app)/gcash/_components/cash-out-dialog.tsx`

- [ ] **Step 1: Write the dialog (Cash Out has no Pending checkbox; total = Amount − Charge)**

```tsx
// src/app/(app)/gcash/_components/cash-out-dialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gcashService } from "@/services/gcash.service";
import { useGCashTiers } from "@/hooks/use-gcash-tiers";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  borrower: { id: number; full_name: string; borrower_code?: string };
  onCreated?(): void;
}

export function CashOutDialog({ open, onOpenChange, borrower, onCreated }: Props) {
  const { resolveCharge, loading: tiersLoading } = useGCashTiers();
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setRemarks("");
    }
  }, [open]);

  const amountNum = Number(amount);
  const charge = useMemo(
    () =>
      Number.isFinite(amountNum) && amountNum > 0
        ? resolveCharge(amountNum, "cash_out")
        : null,
    [amountNum, resolveCharge],
  );
  const total = charge === null ? null : amountNum - charge;
  const canSubmit =
    !submitting &&
    amountNum > 0 &&
    charge !== null &&
    total !== null &&
    total >= 0 &&
    !tiersLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await gcashService.createTransaction({
        borrower_id: borrower.id,
        type: "cash_out",
        amount: amountNum,
        remarks: remarks.trim() || undefined,
      });
      toast.success(
        `Cash Out recorded. Reference: ${res.data?.reference_no ?? "—"}`,
      );
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cash Out — {borrower.full_name}</DialogTitle>
          <DialogDescription>
            Records a GCash Cash Out on behalf of this member. Member receives{" "}
            <span className="font-medium">Amount − Charge</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cashout-amount">Amount (₱)</Label>
            <Input
              id="cashout-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            {amountNum > 0 && charge === null && (
              <p className="text-xs text-destructive">
                No tier covers this amount. Update GCash settings.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground">Charge</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {charge !== null ? formatCurrency(charge) : "—"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {total !== null ? formatCurrency(total) : "—"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cashout-remarks">Remarks (optional)</Label>
            <Textarea
              id="cashout-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Record Cash Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/gcash/_components/cash-out-dialog.tsx
git commit -m "feat(gcash): add Cash Out dialog"
```

---

### Task 12: Members tab

**Files:**
- Modify: `src/app/(app)/gcash/_components/members-tab.tsx` (replace stub)

- [ ] **Step 1: Replace stub with full table**

```tsx
// src/app/(app)/gcash/_components/members-tab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { borrowerService } from "@/services/borrower.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { Borrower } from "@/types";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";

type DialogState =
  | { type: "cash_in"; borrower: Borrower }
  | { type: "cash_out"; borrower: Borrower }
  | null;

export function MembersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [members, setMembers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);

  // simple 300 ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await borrowerService.list({
          search: debounced || undefined,
          per_page: 25,
        });
        if (cancelled) return;
        const data = res.data;
        setMembers(
          Array.isArray(data) ? data : (data?.data ?? []),
        );
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const rows = useMemo(() => members, [members]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name or code…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member Code</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead className="text-right w-[260px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <Loader2 className="inline h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground py-8"
                >
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    {b.borrower_code ?? "—"}
                  </TableCell>
                  <TableCell>{b.full_name ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setDialog({ type: "cash_in", borrower: b })
                      }
                    >
                      Cash In
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDialog({ type: "cash_out", borrower: b })
                      }
                    >
                      Cash Out
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {dialog?.type === "cash_in" && (
        <CashInDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          borrower={{
            id: dialog.borrower.id,
            full_name: dialog.borrower.full_name ?? "",
            borrower_code: dialog.borrower.borrower_code ?? undefined,
          }}
          onCreated={() => setDialog(null)}
        />
      )}
      {dialog?.type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          borrower={{
            id: dialog.borrower.id,
            full_name: dialog.borrower.full_name ?? "",
            borrower_code: dialog.borrower.borrower_code ?? undefined,
          }}
          onCreated={() => setDialog(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm `borrowerService.list` response shape**

The Lendyph codebase wraps lists in `PaginatedResponse<T>` (the data has a `data` array property). The `Array.isArray(data) ? data : (data?.data ?? [])` fallback above tolerates either shape. If the borrower listing already has a list hook in `src/hooks/`, prefer it — grep `useBorrowers` first.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

`pnpm dev` → `/gcash`. Members table loads, search debounces, Cash In / Cash Out buttons open the dialogs. Submitting either button will toast a backend error until the API is wired — wiring is verified by the network request itself.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/gcash/_components/members-tab.tsx
git commit -m "feat(gcash): members tab with cash in/out buttons"
```

---

## Phase 4 — Transactions tab

### Task 13: Paid button (mark-as-paid)

**Files:**
- Create: `src/app/(app)/gcash/_components/paid-button.tsx`

- [ ] **Step 1: Write the button + confirm dialog**

```tsx
// src/app/(app)/gcash/_components/paid-button.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";

interface Props {
  transactionId: number;
  referenceNo: string;
  onPaid?(): void;
}

export function PaidButton({ transactionId, referenceNo, onPaid }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    try {
      await gcashService.markPaid(transactionId);
      toast.success(`Marked ${referenceNo} as paid.`);
      onPaid?.();
      setOpen(false);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Paid
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as paid?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm the member has paid the cash for transaction{" "}
            <span className="font-mono">{referenceNo}</span>. This finalizes
            the income for this row.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={submitting}>
            {submitting ? "Saving…" : "Confirm Paid"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/gcash/_components/paid-button.tsx
git commit -m "feat(gcash): add Paid button with confirm dialog"
```

---

### Task 14: Transactions tab

**Files:**
- Modify: `src/app/(app)/gcash/_components/transactions-tab.tsx` (replace stub)

- [ ] **Step 1: Replace stub with full table**

```tsx
// src/app/(app)/gcash/_components/transactions-tab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  GCashListFilters,
  GCashTransaction,
  GCashTransactionStatus,
  GCashTransactionType,
} from "@/types";
import { PaidButton } from "./paid-button";

const TYPE_OPTIONS: { value: GCashTransactionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "cash_in", label: "Cash In" },
  { value: "cash_out", label: "Cash Out" },
];
const STATUS_OPTIONS: {
  value: GCashTransactionStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "completed", label: "Completed" },
];

function statusBadge(s: GCashTransactionStatus) {
  if (s === "pending")
    return <Badge variant="destructive">Pending</Badge>;
  if (s === "paid") return <Badge>Paid</Badge>;
  return <Badge variant="secondary">Completed</Badge>;
}

export function TransactionsTab() {
  const [filters, setFilters] = useState<{
    type: GCashTransactionType | "all";
    status: GCashTransactionStatus | "all";
    start_date: string;
    end_date: string;
  }>({
    type: "all",
    status: "all",
    start_date: "",
    end_date: "",
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GCashTransaction[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: GCashListFilters = {
          page,
          per_page: 25,
        };
        if (filters.type !== "all") params.type = filters.type;
        if (filters.status !== "all") params.status = filters.status;
        if (filters.start_date) params.start_date = filters.start_date;
        if (filters.end_date) params.end_date = filters.end_date;

        const res = await gcashService.listTransactions(params);
        if (cancelled) return;
        const body = res.data;
        const list = Array.isArray(body) ? body : (body?.data ?? []);
        setRows(list);
        const meta =
          (body as { meta?: { last_page?: number } })?.meta?.last_page;
        setTotalPages(typeof meta === "number" ? meta : 1);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadToken]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select
            value={filters.type}
            onValueChange={(v) =>
              setFilters((p) => ({
                ...p,
                type: v as GCashTransactionType | "all",
              }))
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((p) => ({
                ...p,
                status: v as GCashTransactionStatus | "all",
              }))
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={filters.start_date}
            onChange={(e) =>
              setFilters((p) => ({ ...p, start_date: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={filters.end_date}
            onChange={(e) =>
              setFilters((p) => ({ ...p, end_date: e.target.value }))
            }
          />
        </div>

        <Button variant="ghost" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Charge</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Transactor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <Loader2 className="inline h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground py-8"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.transaction_date)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.reference_no}
                  </TableCell>
                  <TableCell>{r.borrower?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    {r.type === "cash_in" ? "Cash In" : "Cash Out"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.charge_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.total_amount)}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.transactor_user?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.type === "cash_in" && r.status === "pending" && (
                      <PaidButton
                        transactionId={r.id}
                        referenceNo={r.reference_no}
                        onPaid={refresh}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2 items-center text-sm">
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify `formatDate` is exported from `src/lib/format`**

If the project's date format helper has a different name (e.g. `formatLongDate`), update the import. Otherwise leave it as-is.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/gcash/_components/transactions-tab.tsx
git commit -m "feat(gcash): transactions tab with filters and paid action"
```

---

## Phase 5 — Reports tab

### Task 15: Reports tab

**Files:**
- Modify: `src/app/(app)/gcash/_components/reports-tab.tsx` (replace stub)

- [ ] **Step 1: Write the reports tab**

```tsx
// src/app/(app)/gcash/_components/reports-tab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency, formatDate } from "@/lib/format";
import type { GCashIncomeReport, GCashPendingItem } from "@/types";
import { PaidButton } from "./paid-button";

function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function ReportsTab() {
  const [{ start, end }, setRange] = useState(defaultRange);
  const [report, setReport] = useState<GCashIncomeReport | null>(null);
  const [pending, setPending] = useState<GCashPendingItem[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIncomeLoading(true);
      try {
        const res = await gcashService.incomeReport(start, end);
        if (!cancelled) setReport(res.data ?? null);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setIncomeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPendingLoading(true);
      try {
        const res = await gcashService.pendingList();
        if (!cancelled) setPending(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Total Income</CardTitle>
          <CardDescription>
            Charges earned on Cash In (when paid) and Cash Out. Pending Cash
            In rows are excluded until they are marked paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={start}
                onChange={(e) =>
                  setRange((p) => ({ ...p, start: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                value={end}
                onChange={(e) =>
                  setRange((p) => ({ ...p, end: e.target.value }))
                }
              />
            </div>
            <Button variant="ghost" onClick={refresh}>
              Refresh
            </Button>
          </div>

          {incomeLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : report ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">
                  Total Income
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(report.total_income)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Cash In Count
                </div>
                <div className="text-2xl font-semibold">
                  {report.cash_in_count}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Cash Out Count
                </div>
                <div className="text-2xl font-semibold">
                  {report.cash_out_count}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No data for this range.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Payments</CardTitle>
          <CardDescription>
            Cash In transactions awaiting cash collection. Click Paid once the
            member settles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Charge</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Days Pending</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="inline h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : pending.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      No pending payments. 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.transaction_date)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.reference_no}
                      </TableCell>
                      <TableCell>{p.borrower.full_name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.charge_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.days_pending}
                      </TableCell>
                      <TableCell className="text-right">
                        <PaidButton
                          transactionId={p.id}
                          referenceNo={p.reference_no}
                          onPaid={refresh}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

> If the project removes emojis by convention, drop the 🎉 above — but the user has used emojis elsewhere; check git log for examples before removing.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/gcash/_components/reports-tab.tsx
git commit -m "feat(gcash): reports tab with total income and pending payments"
```

---

## Phase 6 — Final pass

### Task 16: Full manual test pass + final type-check

- [ ] **Step 1: Run final type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Run lint (project standard if available)**

Run: `pnpm lint`
Expected: PASS, or warnings only that already exist on `development`. Fix any new errors introduced by the GCash work.

- [ ] **Step 3: Manual test plan** (run with backend if available; otherwise verify wiring + error toasts)

Follow spec §9 verbatim:
1. Settings → GCash. Add tier `min=1, max=1500, cash_in_rate=20, cash_out_rate=15`. Save.
2. GCash → Members → pick any member → Cash In, amount `1000`.
   Charge shows `20.00`, Total shows `1,020.00`. Save. Toast shows reference.
3. Members → Cash Out, amount `3000` (after adding tier `1501–5000: in 50 / out 200`). Total shows `2,800.00`.
4. Cash In `800` with Pending checked → Reports → Pending Payments lists it, `days_pending = 0`. Total Income excludes the 20.
5. Click Paid → row flips to paid; Total Income now includes the 20.
6. Edit tier rates → existing rows unchanged (charge_amount frozen).

- [ ] **Step 4: Commit nothing (manual verification only)**

No commit. If you find a bug, fix it as its own task.

---

### Task 17: Push branch + open PR to `development`

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/gcash-transactions
```

If a pre-push hook fails because of stale Next.js cache (`.next/types/...`), clear it first: `Remove-Item -Recurse -Force .next` (PowerShell), then re-run the push.

- [ ] **Step 2: Open PR to `development`**

```bash
gh pr create --base development --title "feat(gcash): transactions module" --body "$(cat <<'EOF'
## Summary
- New top-level sidebar entry **GCash** with Members / Transactions / Reports tabs
- Cash In / Cash Out flows with tiered auto-charge resolution and frozen `charge_amount`
- Pending Payment workflow with deferred income recognition + Paid action
- Tiered charges editor at `/settings/gcash`
- New permissions: `gcash:view`, `gcash:transact`, `gcash:settings`

## Backend dependency
Seven endpoints required — see chat handoff. Until they ship, the UI renders correctly but list/save calls toast a backend error (expected).

## Test plan
- [ ] Add a tier in `/settings/gcash`, save, reload
- [ ] Cash In 1,000 → charge auto-resolves, total = amount + charge
- [ ] Cash Out 3,000 → total = amount − charge
- [ ] Pending Cash In appears in Reports → Pending Payments; excluded from Total Income
- [ ] Mark Paid flips status + includes income in next refresh
- [ ] Sidebar shows GCash between Collateral and User Management

Spec: `docs/superpowers/specs/2026-05-17-gcash-transactions-design.md`
EOF
)"
```

- [ ] **Step 3: Backend handoff**

In the chat, generate the copy-paste-ready backend handoff for the 7 endpoints (per `swagger-backend-handoff` workflow). No MD file. Include payloads, response shapes, and the permission seeds (`gcash:view`, `gcash:transact`, `gcash:settings`).

---

## Self-review (executed by the planner)

**Spec coverage:**
- §1 Goal — Tasks 9–15
- §2 Approved decisions — Tasks 5 (nav), 8 (settings), 10–11 (charge math), 15 (reports)
- §3 Routes & permissions — Tasks 1, 5, 8, 9
- §4 Data model — Task 2
- §5 Service layer — Tasks 3, 4
- §6 Components & files — Tasks 6, 8, 9–15
- §7 UX flow — Tasks 10, 11, 12, 13, 14, 15
- §8 Error handling — Task 7, used in every fetching task
- §9 Testing approach — Task 16
- §10 Backend gap — Task 17 step 3
- §11 Out of scope — respected (no edit/void, no CSV)

**Placeholder scan:** none — every code block is complete, every step is concrete.

**Type consistency:** `gcashService` exposes `listTransactions`, `createTransaction`, `markPaid`, `listTiers`, `upsertTiers`, `incomeReport`, `pendingList`. Reverified across Tasks 4, 8, 10, 11, 13, 14, 15.

**Naming:** `useGCashTiers` hook (Task 6) consumed by Tasks 10, 11 — matches.

Plan ready.
