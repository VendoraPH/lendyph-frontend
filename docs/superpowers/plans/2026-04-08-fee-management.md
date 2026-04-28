# Fee Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Fee Management page under Settings where users can create, edit, and delete custom fees with type (fixed/percentage), loan product applicability, and optional conditions.

**Architecture:** New page at `/settings/fees` using the same dialog-based CRUD pattern as the Loan Products page. Fee types, service, and API endpoints follow existing conventions. Conditions are stored but not evaluated by frontend.

**Tech Stack:** Next.js App Router, shadcn/ui (Dialog, Card, Table, Checkbox, Select, Input, Badge, DropdownMenu), Tailwind CSS, Axios via api-client, Sonner toasts, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-08-fee-management-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/types/fee.ts` | Fee and FeeConditions interfaces |
| Create | `src/services/fee.service.ts` | CRUD API calls for fees |
| Create | `src/app/(app)/settings/fees/page.tsx` | Fee management page with list + dialog form |
| Modify | `src/config/api-endpoints.ts` | Add FEES endpoint group |
| Modify | `src/types/index.ts` | Re-export fee types |
| Modify | `src/services/index.ts` | Re-export fee service |
| Modify | `src/constants/navigation.ts` | Add "Fees" to Settings sidebar children |

---

### Task 1: Fee Types

**Files:**
- Create: `src/types/fee.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create fee type definitions**

Create `src/types/fee.ts`:

```typescript
export interface FeeConditions {
  term_days_gt?: number;
  term_days_lt?: number;
  term_days_eq?: number;
  loan_amount_gt?: number;
  loan_amount_lt?: number;
  loan_amount_eq?: number;
}

export type FeeType = "fixed" | "percentage";

export interface Fee {
  id: number;
  name: string;
  type: FeeType;
  value: number;
  applicable_product_ids: number[];
  conditions: FeeConditions;
  created_at: string;
  updated_at: string;
}

export interface CreateFeeData {
  name: string;
  type: FeeType;
  value: number;
  applicable_product_ids: number[];
  conditions?: FeeConditions;
}

export type UpdateFeeData = Partial<CreateFeeData>;
```

- [ ] **Step 2: Re-export from types index**

Add to the end of `src/types/index.ts`:

```typescript
export type { Fee, FeeType, FeeConditions, CreateFeeData, UpdateFeeData } from "./fee";
```

- [ ] **Step 3: Commit**

```bash
git add src/types/fee.ts src/types/index.ts
git commit -m "feat: add Fee type definitions"
```

---

### Task 2: API Endpoints & Service

**Files:**
- Modify: `src/config/api-endpoints.ts`
- Create: `src/services/fee.service.ts`
- Modify: `src/services/index.ts`

- [ ] **Step 1: Add FEES endpoints to api-endpoints.ts**

Add after the `LOAN_PRODUCTS` block (before `REPORTS`) in `src/config/api-endpoints.ts`:

```typescript
  FEES: {
    LIST: "/fees",
    CREATE: "/fees",
    DETAIL: (id: number) => `/fees/${id}`,
    UPDATE: (id: number) => `/fees/${id}`,
    DELETE: (id: number) => `/fees/${id}`,
  },
```

- [ ] **Step 2: Create fee service**

Create `src/services/fee.service.ts`:

```typescript
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Fee, CreateFeeData, UpdateFeeData } from "@/types";

export const feeService = {
  list: (params?: Record<string, unknown>) =>
    api.get<Fee[]>(API_ENDPOINTS.FEES.LIST, { params }),

  detail: (id: number) =>
    api.get<Fee>(API_ENDPOINTS.FEES.DETAIL(id)),

  create: (data: CreateFeeData) =>
    api.post<Fee>(API_ENDPOINTS.FEES.CREATE, data),

  update: (id: number, data: UpdateFeeData) =>
    api.put<Fee>(API_ENDPOINTS.FEES.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.FEES.DELETE(id)),
};
```

- [ ] **Step 3: Re-export from services index**

Add to the end of `src/services/index.ts`:

```typescript
export { feeService } from "./fee.service";
```

- [ ] **Step 4: Commit**

```bash
git add src/config/api-endpoints.ts src/services/fee.service.ts src/services/index.ts
git commit -m "feat: add fee API endpoints and service"
```

---

### Task 3: Add Fees to Sidebar Navigation

**Files:**
- Modify: `src/constants/navigation.ts`

- [ ] **Step 1: Add Fees entry to Settings children**

In `src/constants/navigation.ts`, find the Settings nav item's `children` array and add the Fees entry after "Loan Products":

Change:
```typescript
    children: [
      { title: "Profile", href: "/settings/profile" },
      { title: "Loan Products", href: "/settings/loan-products" },
      { title: "Branches", href: "/settings/branches" },
    ],
```

To:
```typescript
    children: [
      { title: "Profile", href: "/settings/profile" },
      { title: "Loan Products", href: "/settings/loan-products" },
      { title: "Fees", href: "/settings/fees" },
      { title: "Branches", href: "/settings/branches" },
    ],
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/navigation.ts
git commit -m "feat: add Fees to sidebar navigation"
```

---

### Task 4: Fee Management Page — Layout, Summary Cards & Table

**Files:**
- Create: `src/app/(app)/settings/fees/page.tsx`

This is the main task. The page follows the exact same structure as `src/app/(app)/loans/products/page.tsx`. Build it in one file since the loan products page is also a single file (~920 lines) and this follows the established pattern.

- [ ] **Step 1: Create the fee management page**

Create `src/app/(app)/settings/fees/page.tsx` with the full implementation:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { feeService } from "@/services/fee.service";
import { loanProductService } from "@/services/loan-product.service";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Receipt,
  DollarSign,
  Percent,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { Fee, FeeType, LoanProduct } from "@/types";

// ── Helpers ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

function formatFeeValue(fee: Fee): string {
  return fee.type === "fixed" ? formatCurrency(fee.value) : `${fee.value}%`;
}

function formatConditions(fee: Fee): string {
  const parts: string[] = [];
  const c = fee.conditions;
  if (!c) return "—";
  if (c.term_days_gt) parts.push(`Term > ${c.term_days_gt}d`);
  if (c.term_days_lt) parts.push(`Term < ${c.term_days_lt}d`);
  if (c.term_days_eq) parts.push(`Term = ${c.term_days_eq}d`);
  if (c.loan_amount_gt) parts.push(`Amount > ${formatCurrency(c.loan_amount_gt)}`);
  if (c.loan_amount_lt) parts.push(`Amount < ${formatCurrency(c.loan_amount_lt)}`);
  if (c.loan_amount_eq) parts.push(`Amount = ${formatCurrency(c.loan_amount_eq)}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function formatAppliesTo(fee: Fee, products: LoanProduct[]): string {
  if (!fee.applicable_product_ids || fee.applicable_product_ids.length === 0) return "None";
  if (fee.applicable_product_ids.length === products.length && products.length > 0) {
    return `All Products (${products.length})`;
  }
  const names = fee.applicable_product_ids
    .map((id) => products.find((p) => p.id === id)?.name)
    .filter(Boolean);
  return names.join(", ") || "None";
}

const typeBadge: Record<FeeType, string> = {
  fixed: "bg-green-100 text-green-700 border-green-200",
  percentage: "bg-blue-100 text-blue-700 border-blue-200",
};

// ── Form Types ──

interface FeeForm {
  name: string;
  type: FeeType;
  value: string;
  applicable_product_ids: number[];
  term_days_gt: string;
  term_days_lt: string;
  term_days_eq: string;
  loan_amount_gt: string;
  loan_amount_lt: string;
  loan_amount_eq: string;
}

const EMPTY_FORM: FeeForm = {
  name: "",
  type: "fixed",
  value: "",
  applicable_product_ids: [],
  term_days_gt: "",
  term_days_lt: "",
  term_days_eq: "",
  loan_amount_gt: "",
  loan_amount_lt: "",
  loan_amount_eq: "",
};

function feeToForm(fee: Fee): FeeForm {
  const c = fee.conditions ?? {};
  return {
    name: fee.name,
    type: fee.type,
    value: String(fee.value),
    applicable_product_ids: fee.applicable_product_ids ?? [],
    term_days_gt: c.term_days_gt ? String(c.term_days_gt) : "",
    term_days_lt: c.term_days_lt ? String(c.term_days_lt) : "",
    term_days_eq: c.term_days_eq ? String(c.term_days_eq) : "",
    loan_amount_gt: c.loan_amount_gt ? String(c.loan_amount_gt) : "",
    loan_amount_lt: c.loan_amount_lt ? String(c.loan_amount_lt) : "",
    loan_amount_eq: c.loan_amount_eq ? String(c.loan_amount_eq) : "",
  };
}

function formToApiPayload(form: FeeForm) {
  const conditions: Record<string, number> = {};
  if (form.term_days_gt) conditions.term_days_gt = Number(form.term_days_gt);
  if (form.term_days_lt) conditions.term_days_lt = Number(form.term_days_lt);
  if (form.term_days_eq) conditions.term_days_eq = Number(form.term_days_eq);
  if (form.loan_amount_gt) conditions.loan_amount_gt = Number(form.loan_amount_gt);
  if (form.loan_amount_lt) conditions.loan_amount_lt = Number(form.loan_amount_lt);
  if (form.loan_amount_eq) conditions.loan_amount_eq = Number(form.loan_amount_eq);

  return {
    name: form.name,
    type: form.type,
    value: Number(form.value),
    applicable_product_ids: form.applicable_product_ids,
    conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
  };
}

// ── Fee Form Dialog ──

function FeeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: FeeForm) => void;
  initialData?: FeeForm;
  title: string;
  description: string;
  products: LoanProduct[];
}) {
  const [form, setForm] = useState<FeeForm>(initialData ?? EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(initialData ?? EMPTY_FORM);
    }
  }, [open, initialData]);

  const update = (field: keyof FeeForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleProduct = (productId: number) => {
    setForm((prev) => ({
      ...prev,
      applicable_product_ids: prev.applicable_product_ids.includes(productId)
        ? prev.applicable_product_ids.filter((id) => id !== productId)
        : [...prev.applicable_product_ids, productId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.applicable_product_ids.length === 0) {
      toast.error("Please select at least one loan product");
      return;
    }
    onSubmit(form);
    if (!initialData) setForm(EMPTY_FORM);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Basic Info
            </h3>
            <div className="space-y-2">
              <Label htmlFor="fee-name">Fee Name <span className="text-red-500">*</span></Label>
              <Input
                id="fee-name"
                placeholder="e.g. Notarial Fee"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type <span className="text-red-500">*</span></Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => update("type", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="formula" disabled>
                      Formula (Coming Soon)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee-value">
                  {form.type === "fixed" ? "Amount (PHP)" : "Rate (%)"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fee-value"
                  type="number"
                  min={0}
                  step={form.type === "fixed" ? "1" : "0.01"}
                  placeholder={form.type === "fixed" ? "500" : "2"}
                  value={form.value}
                  onChange={(e) => update("value", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Applicable Loan Products */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Applicable Loan Products
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No loan products found.</p>
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={form.applicable_product_ids.includes(product.id)}
                      onCheckedChange={() => toggleProduct(product.id)}
                    />
                    <span className="text-sm">{product.name}</span>
                    {!product.is_active && (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                        Inactive
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Additional Conditions */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Additional Conditions
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Optional — leave blank if the fee applies unconditionally
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Term (Days) */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Term (Days)
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-muted-foreground shrink-0">Greater than</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={form.term_days_gt}
                      onChange={(e) => update("term_days_gt", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-muted-foreground shrink-0">Less than</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={form.term_days_lt}
                      onChange={(e) => update("term_days_lt", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-muted-foreground shrink-0">Equal to</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={form.term_days_eq}
                      onChange={(e) => update("term_days_eq", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Loan Amount */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Loan Amount
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-muted-foreground shrink-0">Greater than</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={form.loan_amount_gt}
                      onChange={(e) => update("loan_amount_gt", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-muted-foreground shrink-0">Less than</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={form.loan_amount_lt}
                      onChange={(e) => update("loan_amount_lt", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-muted-foreground shrink-0">Equal to</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={form.loan_amount_eq}
                      onChange={(e) => update("loan_amount_eq", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tiered Charges — Coming Soon */}
          <div className="rounded-lg border p-3 opacity-50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tiered Charges</span>
              <Badge variant="outline" className="text-xs">Coming Soon</Badge>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {initialData ? "Save Changes" : "Create Fee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Fee Dialog ──

function DeleteFeeDialog({
  fee,
  open,
  onOpenChange,
  onConfirm,
}: {
  fee: Fee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Fee
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{fee.name}&quot;?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Fee Actions Cell ──

function FeeActionsCell({
  fee,
  onEdit: handleEdit,
  onDelete: handleDelete,
  products,
}: {
  fee: Fee;
  onEdit: (form: FeeForm) => void;
  onDelete: () => void;
  products: LoanProduct[];
}) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenDialog("edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeeFormDialog
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSubmit={handleEdit}
        initialData={feeToForm(fee)}
        title="Edit Fee"
        description={`Update the configuration for ${fee.name}.`}
        products={products}
      />
      <DeleteFeeDialog
        fee={fee}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ── Main Page ──

export default function FeeManagementPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [feesRes, productsRes] = await Promise.allSettled([
        feeService.list(),
        loanProductService.list(),
      ]);
      setFees(
        feesRes.status === "fulfilled"
          ? Array.isArray(feesRes.value)
            ? feesRes.value
            : (feesRes.value as unknown as { data: Fee[] }).data ?? []
          : []
      );
      setProducts(
        productsRes.status === "fulfilled"
          ? Array.isArray(productsRes.value)
            ? productsRes.value
            : (productsRes.value as unknown as { data: LoanProduct[] }).data ?? []
          : []
      );
      if (feesRes.status === "rejected") {
        toast.error("Failed to load fees");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fixedCount = fees.filter((f) => f.type === "fixed").length;
  const percentageCount = fees.filter((f) => f.type === "percentage").length;

  const handleAdd = async (form: FeeForm) => {
    try {
      const payload = formToApiPayload(form);
      await feeService.create(payload);
      toast.success("Fee created");
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const firstError = Object.values(apiErrors)[0]?.[0];
        toast.error(firstError || "Validation failed");
      } else {
        toast.error(err?.response?.data?.message || "Failed to create fee");
      }
    }
  };

  const handleEdit = async (id: number, form: FeeForm) => {
    try {
      const payload = formToApiPayload(form);
      await feeService.update(id, payload);
      toast.success("Fee updated");
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to update fee");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await feeService.delete(id);
      toast.success("Fee deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete fee");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-muted-foreground">
            Create and manage fees applied to loan products
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Fee
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4" />
                <span className="text-sm font-medium">Total Fees</span>
              </div>
              <span className="text-2xl font-bold">{fees.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Fixed</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {fixedCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600">
                <Percent className="h-4 w-4" />
                <span className="text-sm font-medium">Percentage</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {percentageCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-brand-orange" />
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            <p className="text-sm font-medium text-muted-foreground">
              All Fees ({fees.length})
            </p>
            {fees.map((fee) => (
              <Card key={fee.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{fee.name}</p>
                        <Badge variant="outline" className={typeBadge[fee.type]}>
                          {fee.type === "fixed" ? "Fixed" : "Percentage"}
                        </Badge>
                      </div>
                    </div>
                    <FeeActionsCell
                      fee={fee}
                      onEdit={(form) => handleEdit(fee.id, form)}
                      onDelete={() => handleDelete(fee.id)}
                      products={products}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-medium">{formatFeeValue(fee)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Applies To</p>
                      <p className="text-xs">{formatAppliesTo(fee, products)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Conditions</p>
                      <p className="text-xs">{formatConditions(fee)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {fees.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No fees found. Add one to get started.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                All Fees ({fees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell>
                          <p className="font-medium">{fee.name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeBadge[fee.type]}>
                            {fee.type === "fixed" ? "Fixed" : "Percentage"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFeeValue(fee)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {formatAppliesTo(fee, products)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {formatConditions(fee)}
                        </TableCell>
                        <TableCell>
                          <FeeActionsCell
                            fee={fee}
                            onEdit={(form) => handleEdit(fee.id, form)}
                            onDelete={() => handleDelete(fee.id)}
                            products={products}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {fees.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No fees found. Add one to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Fee Dialog */}
      <FeeFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
        title="Add New Fee"
        description="Create a new fee that will be applied to selected loan products."
        products={products}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx next build 2>&1 | tail -20`

Expected: Build succeeds (or only warns about API connection — not type errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/settings/fees/page.tsx
git commit -m "feat: add fee management page with CRUD, conditions, and loan product applicability"
```

---

### Task 5: Verify & Test Manually

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to /settings/fees**

Open `http://localhost:3000/settings/fees` in the browser. Verify:
- Page loads with header, 3 summary cards (all showing 0), empty table state
- "Add New Fee" button opens the dialog
- Dialog has all sections: Basic Info, Applicable Loan Products, Additional Conditions, Tiered Charges (coming soon)
- Type dropdown shows Fixed, Percentage, and Formula (disabled)
- Loan products checkbox list loads from API
- Form validates: name required, value required, at least one product selected
- Cancel closes the dialog

- [ ] **Step 3: Check sidebar navigation**

Verify Settings > Fees appears in the sidebar and navigates correctly.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: verify fee management page working"
```
