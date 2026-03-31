# Borrower Search & Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the borrower management page with status filtering, loan summary columns, and a borrower detail drawer with loan history — while splitting the 1300-line monolith into focused components.

**Architecture:** Extract the existing borrowers page into composable components under `_components/`. Add a Sheet-based detail drawer (right side) that shows full borrower profile and mock loan history. Use the existing Sheet component (base-ui) for the drawer since it supports `side="right"` with proper animations. Add status filter tabs alongside the existing search bar.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, base-ui Sheet, lucide-react icons, existing UI components from `@/components/ui/`.

---

## File Structure

```
src/app/(dashboard)/borrowers/
  page.tsx                         — slimmed page: state management, layout, summary cards
  _components/
    borrower-filters.tsx           — search input + status filter tabs
    borrower-table.tsx             — data table with loan columns, clickable rows
    borrower-detail-sheet.tsx      — right-side sheet: full profile + loan history
    borrower-form-dialog.tsx       — add/edit borrower dialogs (extracted)
    borrower-actions.tsx           — row action menu + toggle/delete dialogs
    mock-data.ts                   — borrower mock data + loan mock data
    utils.ts                       — shared helpers (formatCurrency, formatDate, getInitials, etc.)
```

**Key decisions:**
- `_components/` prefix: Next.js App Router convention for non-route folders
- Sheet (not Drawer): The existing `Sheet` component uses base-ui Dialog with side positioning — better for a right-panel detail view. The `Drawer` (vaul) is bottom-sheet style.
- Mock loan data lives with borrower mock data since they're tightly coupled

---

### Task 1: Extract Utilities and Mock Data

**Files:**
- Create: `src/app/(dashboard)/borrowers/_components/utils.ts`
- Create: `src/app/(dashboard)/borrowers/_components/mock-data.ts`

- [ ] **Step 1: Create utils.ts with shared helpers**

```ts
import type { BorrowerStatus } from "@/types";

export const statusBadgeColor: Record<BorrowerStatus, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
  blacklisted: "bg-gray-900 text-white border-gray-700",
};

export function generateBorrowerCode(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `BRW-${year}${seq}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function buildFullName(form: {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
}): string {
  const middle = form.middle_name ? ` ${form.middle_name.charAt(0)}.` : "";
  const suffix = form.suffix ? ` ${form.suffix}` : "";
  return `${form.first_name}${middle} ${form.last_name}${suffix}`.trim();
}
```

- [ ] **Step 2: Create mock-data.ts with borrowers and loan history**

```ts
import type { Borrower, Loan } from "@/types";

export const INITIAL_BORROWERS: Borrower[] = [
  {
    id: 1,
    borrower_code: "BRW-20260001",
    first_name: "Rosario",
    middle_name: "Dela Cruz",
    last_name: "Santos",
    full_name: "Rosario D. Santos",
    birthdate: "1988-05-14",
    civil_status: "married",
    gender: "female",
    email: "rosario.santos@gmail.com",
    phone: "09171234567",
    address: "123 Rizal St.",
    barangay: "San Antonio",
    city: "Makati",
    province: "Metro Manila",
    zip_code: "1200",
    employer_or_business: "Jollibee Foods Corp.",
    employment_type: "employed",
    monthly_income: 28000,
    valid_id_type: "philippine_id",
    valid_id_number: "1234-5678-9012-3456",
    status: "active",
    total_loans: 3,
    total_outstanding: 15000,
    created_at: "2026-01-15",
    updated_at: "2026-03-01",
  },
  {
    id: 2,
    borrower_code: "BRW-20260002",
    first_name: "Roberto",
    last_name: "Garcia",
    full_name: "Roberto Garcia",
    birthdate: "1975-11-22",
    civil_status: "married",
    gender: "male",
    phone: "09181234567",
    address: "45 Mabini Ave.",
    barangay: "Poblacion",
    city: "Cebu City",
    province: "Cebu",
    zip_code: "6000",
    employer_or_business: "Garcia Sari-Sari Store",
    employment_type: "self_employed",
    monthly_income: 35000,
    valid_id_type: "drivers_license",
    valid_id_number: "N01-12-345678",
    status: "active",
    total_loans: 5,
    total_outstanding: 42000,
    created_at: "2026-01-20",
    updated_at: "2026-02-15",
  },
  {
    id: 3,
    borrower_code: "BRW-20260003",
    first_name: "Maria",
    middle_name: "Lopez",
    last_name: "Reyes",
    full_name: "Maria L. Reyes",
    suffix: "Jr.",
    birthdate: "1992-08-03",
    civil_status: "single",
    gender: "female",
    email: "maria.reyes@gmail.com",
    phone: "09191234567",
    address: "789 Bonifacio St.",
    barangay: "Sta. Cruz",
    city: "Davao City",
    province: "Davao del Sur",
    zip_code: "8000",
    employer_or_business: "SM Retail Inc.",
    employment_type: "employed",
    monthly_income: 22000,
    valid_id_type: "sss",
    valid_id_number: "34-1234567-8",
    status: "active",
    total_loans: 1,
    total_outstanding: 8000,
    created_at: "2026-02-01",
    updated_at: "2026-03-15",
  },
  {
    id: 4,
    borrower_code: "BRW-20260004",
    first_name: "Eduardo",
    last_name: "Mendoza",
    full_name: "Eduardo Mendoza",
    birthdate: "1980-03-18",
    civil_status: "widowed",
    gender: "male",
    phone: "09201234567",
    address: "12 Aguinaldo Rd.",
    barangay: "San Isidro",
    city: "Malolos",
    province: "Bulacan",
    zip_code: "3000",
    employer_or_business: "OFW — Saudi Arabia",
    employment_type: "ofw",
    monthly_income: 65000,
    valid_id_type: "passport",
    valid_id_number: "P1234567A",
    status: "active",
    total_loans: 2,
    total_outstanding: 28000,
    created_at: "2026-02-10",
    updated_at: "2026-03-20",
  },
  {
    id: 5,
    borrower_code: "BRW-20260005",
    first_name: "Carmen",
    middle_name: "Aquino",
    last_name: "Torres",
    full_name: "Carmen A. Torres",
    birthdate: "1995-12-25",
    civil_status: "separated",
    gender: "female",
    email: "carmen.torres@yahoo.com",
    phone: "09211234567",
    address: "56 Luna St.",
    barangay: "Bagumbayan",
    city: "Binan",
    province: "Laguna",
    zip_code: "4024",
    employment_type: "unemployed",
    status: "inactive",
    total_loans: 1,
    total_outstanding: 0,
    created_at: "2026-03-01",
    updated_at: "2026-03-25",
  },
  {
    id: 6,
    borrower_code: "BRW-20260006",
    first_name: "Danilo",
    last_name: "Villanueva",
    full_name: "Danilo Villanueva",
    birthdate: "1970-07-09",
    civil_status: "married",
    gender: "male",
    phone: "09221234567",
    address: "33 Quezon Blvd.",
    barangay: "Sampaguita",
    city: "Angeles City",
    province: "Pampanga",
    zip_code: "2009",
    employer_or_business: "Villanueva Trading",
    employment_type: "self_employed",
    monthly_income: 50000,
    valid_id_type: "umid",
    valid_id_number: "0012-3456789-0",
    status: "blacklisted",
    total_loans: 4,
    total_outstanding: 95000,
    created_at: "2026-01-05",
    updated_at: "2026-03-28",
  },
];

// Mock loan history keyed by borrower id
export const MOCK_LOANS: Record<number, Loan[]> = {
  1: [
    {
      id: 101,
      borrower_id: 1,
      principal_amount: 20000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 6,
      payment_frequency: "monthly",
      total_payable: 23600,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Tuition fee",
      released_at: "2026-01-20",
      maturity_date: "2026-07-20",
      created_at: "2026-01-15",
      updated_at: "2026-07-20",
    },
    {
      id: 102,
      borrower_id: 1,
      principal_amount: 15000,
      interest_rate: 2.5,
      interest_type: "fixed",
      term_months: 3,
      payment_frequency: "monthly",
      total_payable: 16125,
      outstanding_balance: 8000,
      status: "ongoing",
      purpose: "Medical expenses",
      released_at: "2026-02-10",
      maturity_date: "2026-05-10",
      next_due_date: "2026-04-10",
      created_at: "2026-02-10",
      updated_at: "2026-03-15",
    },
    {
      id: 103,
      borrower_id: 1,
      principal_amount: 10000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 4,
      payment_frequency: "monthly",
      total_payable: 11200,
      outstanding_balance: 7000,
      status: "ongoing",
      purpose: "Home repair",
      released_at: "2026-03-01",
      maturity_date: "2026-07-01",
      next_due_date: "2026-04-01",
      created_at: "2026-03-01",
      updated_at: "2026-03-15",
    },
  ],
  2: [
    {
      id: 201,
      borrower_id: 2,
      principal_amount: 50000,
      interest_rate: 2,
      interest_type: "diminishing",
      term_months: 12,
      payment_frequency: "monthly",
      total_payable: 56500,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Business capital",
      released_at: "2025-06-15",
      maturity_date: "2026-06-15",
      created_at: "2025-06-10",
      updated_at: "2026-02-15",
    },
    {
      id: 202,
      borrower_id: 2,
      principal_amount: 30000,
      interest_rate: 2.5,
      interest_type: "fixed",
      term_months: 6,
      payment_frequency: "monthly",
      total_payable: 34500,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Inventory purchase",
      released_at: "2025-09-01",
      maturity_date: "2026-03-01",
      created_at: "2025-08-28",
      updated_at: "2026-03-01",
    },
    {
      id: 203,
      borrower_id: 2,
      principal_amount: 40000,
      interest_rate: 2,
      interest_type: "fixed",
      term_months: 6,
      payment_frequency: "monthly",
      total_payable: 44800,
      outstanding_balance: 22000,
      status: "ongoing",
      purpose: "Store renovation",
      released_at: "2026-01-20",
      maturity_date: "2026-07-20",
      next_due_date: "2026-04-20",
      created_at: "2026-01-20",
      updated_at: "2026-03-20",
    },
    {
      id: 204,
      borrower_id: 2,
      principal_amount: 25000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 3,
      payment_frequency: "bi_weekly",
      total_payable: 27250,
      outstanding_balance: 20000,
      status: "ongoing",
      purpose: "Emergency fund",
      released_at: "2026-02-15",
      maturity_date: "2026-05-15",
      next_due_date: "2026-04-01",
      created_at: "2026-02-15",
      updated_at: "2026-03-15",
    },
    {
      id: 205,
      borrower_id: 2,
      principal_amount: 15000,
      interest_rate: 2.5,
      interest_type: "fixed",
      term_months: 4,
      payment_frequency: "monthly",
      total_payable: 16500,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Personal",
      released_at: "2025-04-01",
      maturity_date: "2025-08-01",
      created_at: "2025-04-01",
      updated_at: "2025-08-01",
    },
  ],
  3: [
    {
      id: 301,
      borrower_id: 3,
      principal_amount: 10000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 3,
      payment_frequency: "monthly",
      total_payable: 10900,
      outstanding_balance: 8000,
      status: "ongoing",
      purpose: "Gadget purchase",
      released_at: "2026-03-01",
      maturity_date: "2026-06-01",
      next_due_date: "2026-04-01",
      created_at: "2026-03-01",
      updated_at: "2026-03-15",
    },
  ],
  4: [
    {
      id: 401,
      borrower_id: 4,
      principal_amount: 100000,
      interest_rate: 2,
      interest_type: "diminishing",
      term_months: 12,
      payment_frequency: "monthly",
      total_payable: 113000,
      outstanding_balance: 0,
      status: "completed",
      purpose: "House construction",
      released_at: "2025-05-01",
      maturity_date: "2026-05-01",
      created_at: "2025-05-01",
      updated_at: "2026-03-01",
    },
    {
      id: 402,
      borrower_id: 4,
      principal_amount: 50000,
      interest_rate: 2.5,
      interest_type: "fixed",
      term_months: 6,
      payment_frequency: "monthly",
      total_payable: 57500,
      outstanding_balance: 28000,
      status: "ongoing",
      purpose: "Lot purchase",
      released_at: "2026-02-01",
      maturity_date: "2026-08-01",
      next_due_date: "2026-04-01",
      created_at: "2026-02-01",
      updated_at: "2026-03-20",
    },
  ],
  5: [
    {
      id: 501,
      borrower_id: 5,
      principal_amount: 8000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 2,
      payment_frequency: "monthly",
      total_payable: 8480,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Personal needs",
      released_at: "2026-03-05",
      maturity_date: "2026-05-05",
      created_at: "2026-03-01",
      updated_at: "2026-03-25",
    },
  ],
  6: [
    {
      id: 601,
      borrower_id: 6,
      principal_amount: 80000,
      interest_rate: 2.5,
      interest_type: "fixed",
      term_months: 12,
      payment_frequency: "monthly",
      total_payable: 104000,
      outstanding_balance: 65000,
      status: "ongoing",
      purpose: "Business expansion",
      released_at: "2025-10-01",
      maturity_date: "2026-10-01",
      next_due_date: "2026-04-01",
      created_at: "2025-10-01",
      updated_at: "2026-03-28",
    },
    {
      id: 602,
      borrower_id: 6,
      principal_amount: 30000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 6,
      payment_frequency: "monthly",
      total_payable: 35400,
      outstanding_balance: 30000,
      status: "defaulted",
      purpose: "Inventory",
      released_at: "2025-07-01",
      maturity_date: "2026-01-01",
      created_at: "2025-07-01",
      updated_at: "2026-01-15",
    },
    {
      id: 603,
      borrower_id: 6,
      principal_amount: 20000,
      interest_rate: 2,
      interest_type: "fixed",
      term_months: 4,
      payment_frequency: "monthly",
      total_payable: 21600,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Equipment",
      released_at: "2025-03-01",
      maturity_date: "2025-07-01",
      created_at: "2025-03-01",
      updated_at: "2025-07-01",
    },
    {
      id: 604,
      borrower_id: 6,
      principal_amount: 15000,
      interest_rate: 3,
      interest_type: "fixed",
      term_months: 3,
      payment_frequency: "monthly",
      total_payable: 16350,
      outstanding_balance: 0,
      status: "completed",
      purpose: "Personal",
      released_at: "2025-01-01",
      maturity_date: "2025-04-01",
      created_at: "2025-01-01",
      updated_at: "2025-04-01",
    },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/_components/utils.ts src/app/\(dashboard\)/borrowers/_components/mock-data.ts
git commit -m "refactor: extract borrower utils and mock data into separate modules"
```

---

### Task 2: Extract Borrower Filters Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/_components/borrower-filters.tsx`

- [ ] **Step 1: Create borrower-filters.tsx**

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import type { BorrowerStatus } from "@/types";

type StatusFilter = BorrowerStatus | "all";

interface BorrowerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  counts: { all: number; active: number; inactive: number; blacklisted: number };
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
];

export function BorrowerFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  counts,
}: BorrowerFiltersProps) {
  const hasFilters = search || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onStatusFilterChange(tab.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-brand-orange text-brand-orange-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs tabular-nums ${
                statusFilter === tab.value
                  ? "text-brand-orange-foreground/80"
                  : "text-muted-foreground"
              }`}
            >
              {counts[tab.value]}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, ID, phone..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              onSearchChange("");
              onStatusFilterChange("all");
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export type { StatusFilter };
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/_components/borrower-filters.tsx
git commit -m "feat: add borrower filters component with status tabs and search"
```

---

### Task 3: Extract Borrower Actions Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/_components/borrower-actions.tsx`

Extract the `BorrowerActionsCell`, `EditBorrowerDialog`, `ToggleStatusDialog`, `DeleteBorrowerDialog` components from the current page into this file. These are currently at lines 759-1107 in `page.tsx`.

- [ ] **Step 1: Create borrower-actions.tsx**

Copy the following from the current `page.tsx`:
- `BorrowerFormTabs` component (lines 369-755)
- `EditBorrowerDialog` component (lines 856-942)
- `ToggleStatusDialog` component (lines 946-994)
- `DeleteBorrowerDialog` component (lines 998-1039)
- `BorrowerActionsCell` component (lines 1043-1107)
- The `BorrowerForm` interface (lines 80-103)
- The `emptyForm` and `borrowerToForm` helper functions (lines 313-365)

All imports should be updated to reference `@/components/ui/*`, `@/constants`, `@/types`, and `../utils` (for `formatDate`).

Export: `BorrowerActionsCell`, `AddBorrowerDialog`, `BorrowerForm`, `emptyForm`, `borrowerToForm`, `BorrowerFormTabs`.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/_components/borrower-actions.tsx
git commit -m "refactor: extract borrower action dialogs into dedicated component"
```

---

### Task 4: Create Borrower Detail Sheet

**Files:**
- Create: `src/app/(dashboard)/borrowers/_components/borrower-detail-sheet.tsx`

- [ ] **Step 1: Create borrower-detail-sheet.tsx**

```tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  X,
  Pencil,
  CreditCard,
} from "lucide-react";
import type { Borrower, Loan } from "@/types";
import { statusBadgeColor, formatCurrency, formatDate, getInitials } from "./utils";
import { MOCK_LOANS } from "./mock-data";
import { LOAN_STATUS_LABELS, PAYMENT_FREQUENCY_LABELS } from "@/constants";

const loanStatusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200",
  ongoing: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  defaulted: "bg-red-100 text-red-700 border-red-200",
  restructured: "bg-orange-100 text-orange-700 border-orange-200",
  rejected: "bg-red-100 text-red-500 border-red-200",
};

interface BorrowerDetailSheetProps {
  borrower: Borrower | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (borrower: Borrower) => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export function BorrowerDetailSheet({
  borrower,
  open,
  onOpenChange,
  onEdit,
}: BorrowerDetailSheetProps) {
  if (!borrower) return null;

  const loans = MOCK_LOANS[borrower.id] ?? [];
  const ongoingLoans = loans.filter((l) => l.status === "ongoing");
  const completedLoans = loans.filter((l) => l.status === "completed");
  const defaultedLoans = loans.filter((l) => l.status === "defaulted");
  const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding_balance, 0);

  const address = [borrower.address, borrower.barangay, borrower.city, borrower.province]
    .filter(Boolean)
    .join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {borrower.photo ? (
                <AvatarImage src={borrower.photo} alt={borrower.full_name} />
              ) : null}
              <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-lg font-semibold">
                {getInitials(borrower.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-lg">{borrower.full_name}</SheetTitle>
              <SheetDescription className="font-mono text-brand-orange">
                {borrower.borrower_code}
              </SheetDescription>
              <Badge variant="outline" className={`mt-1 ${statusBadgeColor[borrower.status]}`}>
                {borrower.status}
              </Badge>
            </div>
          </div>
          <SheetClose render={
            <button className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          } />
        </div>

        <div className="space-y-6 p-6">
          {/* Personal & Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </h3>
            <div className="space-y-3">
              <InfoRow icon={Phone} label="Phone" value={borrower.phone} />
              <InfoRow icon={Mail} label="Email" value={borrower.email} />
              <InfoRow icon={MapPin} label="Address" value={address || undefined} />
              <InfoRow icon={Calendar} label="Birthdate" value={borrower.birthdate ? formatDate(borrower.birthdate) : undefined} />
              <InfoRow icon={Briefcase} label="Employer" value={borrower.employer_or_business} />
              <InfoRow
                icon={CreditCard}
                label="Monthly Income"
                value={borrower.monthly_income ? formatCurrency(borrower.monthly_income) : undefined}
              />
            </div>
          </div>

          <Separator />

          {/* Loan Summary Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Loan Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Loans</p>
                <p className="text-xl font-bold">{loans.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold text-brand-orange">
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ongoing</p>
                <p className="text-xl font-bold text-green-600">{ongoingLoans.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-bold text-gray-600">{completedLoans.length}</p>
              </div>
            </div>
            {defaultedLoans.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-600">Defaulted Loans</p>
                <p className="text-xl font-bold text-red-700">{defaultedLoans.length}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Loan History Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Loan History
            </h3>
            {loans.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Purpose</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Balance</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{loan.purpose || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {loan.released_at ? formatDate(loan.released_at) : "—"} · {loan.term_months}mo
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {loan.outstanding_balance > 0
                            ? formatCurrency(loan.outstanding_balance)
                            : "Paid"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={loanStatusColor[loan.status]}>
                            {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No loan history found.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onEdit(borrower)}
              className="flex-1 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Note: Check the actual Sheet component API — it uses base-ui Dialog. Verify `SheetTitle`, `SheetDescription`, `SheetClose` are exported from `@/components/ui/sheet`. If they're not, use the raw Dialog title/description or add the needed exports. Read the sheet.tsx file fully before implementing.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/_components/borrower-detail-sheet.tsx
git commit -m "feat: add borrower detail sheet with profile info and loan history"
```

---

### Task 5: Create Borrower Table Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/_components/borrower-table.tsx`

- [ ] **Step 1: Create borrower-table.tsx**

```tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Borrower } from "@/types";
import { statusBadgeColor, formatCurrency, getInitials } from "./utils";
import { BorrowerActionsCell } from "./borrower-actions";

interface BorrowerTableProps {
  borrowers: Borrower[];
  onEdit: (updated: Borrower) => void;
  onToggleStatus: (id: number) => void;
  onDelete: (id: number) => void;
  onRowClick: (borrower: Borrower) => void;
}

export function BorrowerTable({
  borrowers,
  onEdit,
  onToggleStatus,
  onDelete,
  onRowClick,
}: BorrowerTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Borrower</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Loans</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {borrowers.map((borrower) => (
            <TableRow
              key={borrower.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(borrower)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    {borrower.photo ? (
                      <AvatarImage src={borrower.photo} alt={borrower.full_name} />
                    ) : null}
                    <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xs font-semibold">
                      {getInitials(borrower.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{borrower.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {borrower.borrower_code}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{borrower.phone}</TableCell>
              <TableCell className="text-muted-foreground">
                {[borrower.city, borrower.province].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {borrower.total_loans}
              </TableCell>
              <TableCell className="text-right tabular-nums text-brand-orange font-medium">
                {borrower.total_outstanding
                  ? formatCurrency(borrower.total_outstanding)
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusBadgeColor[borrower.status]}>
                  {borrower.status}
                </Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <BorrowerActionsCell
                  borrower={borrower}
                  onEdit={onEdit}
                  onToggleStatus={() => onToggleStatus(borrower.id)}
                  onDelete={() => onDelete(borrower.id)}
                />
              </TableCell>
            </TableRow>
          ))}
          {borrowers.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No borrowers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/_components/borrower-table.tsx
git commit -m "feat: add borrower table component with loan columns and clickable rows"
```

---

### Task 6: Rewrite the Main Page

**Files:**
- Modify: `src/app/(dashboard)/borrowers/page.tsx` (full rewrite — replace all 1321 lines)

- [ ] **Step 1: Rewrite page.tsx to compose extracted components**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, AlertTriangle } from "lucide-react";
import type { Borrower, BorrowerStatus } from "@/types";
import { INITIAL_BORROWERS } from "./_components/mock-data";
import { BorrowerFilters, type StatusFilter } from "./_components/borrower-filters";
import { BorrowerTable } from "./_components/borrower-table";
import { BorrowerDetailSheet } from "./_components/borrower-detail-sheet";
import { AddBorrowerDialog } from "./_components/borrower-actions";

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>(INITIAL_BORROWERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Counts for filter tabs
  const activeCount = borrowers.filter((b) => b.status === "active").length;
  const inactiveCount = borrowers.filter((b) => b.status === "inactive").length;
  const blacklistedCount = borrowers.filter((b) => b.status === "blacklisted").length;

  // Filtering logic
  const filteredBorrowers = borrowers.filter((b) => {
    // Status filter
    if (statusFilter !== "all" && b.status !== statusFilter) return false;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      return (
        b.full_name.toLowerCase().includes(q) ||
        b.borrower_code.toLowerCase().includes(q) ||
        b.phone.includes(q)
      );
    }
    return true;
  });

  const handleAdd = (newBorrower: Borrower) => {
    setBorrowers((prev) => [newBorrower, ...prev]);
  };

  const handleEdit = (updated: Borrower) => {
    setBorrowers((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    // Update the selected borrower if it's the one being edited
    if (selectedBorrower?.id === updated.id) {
      setSelectedBorrower(updated);
    }
  };

  const handleToggleStatus = (id: number) => {
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, status: (b.status === "active" ? "inactive" : "active") as BorrowerStatus }
          : b
      )
    );
  };

  const handleDelete = (id: number) => {
    setBorrowers((prev) => prev.filter((b) => b.id !== id));
    if (selectedBorrower?.id === id) {
      setDetailOpen(false);
      setSelectedBorrower(null);
    }
  };

  const handleRowClick = (borrower: Borrower) => {
    setSelectedBorrower(borrower);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Borrower Management</h1>
          <p className="text-muted-foreground">
            Search, filter, and manage borrower profiles
          </p>
        </div>
        <AddBorrowerDialog onAdd={handleAdd} borrowerCount={borrowers.length} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Borrowers</p>
                <p className="text-2xl font-bold">{borrowers.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-red-600">{inactiveCount}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Blacklisted</p>
                <p className="text-2xl font-bold">{blacklistedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <BorrowerFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            counts={{
              all: borrowers.length,
              active: activeCount,
              inactive: inactiveCount,
              blacklisted: blacklistedCount,
            }}
          />
        </CardHeader>
        <CardContent>
          <BorrowerTable
            borrowers={filteredBorrowers}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <BorrowerDetailSheet
        borrower={selectedBorrower}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(borrower) => {
          // Close the detail sheet and trigger the edit dialog
          // For now, this is handled by the action menu in the table
          setDetailOpen(false);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npm run build` or `npx next build`
Expected: No TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/page.tsx
git commit -m "feat: rewrite borrowers page with status filters, loan columns, and detail sheet"
```

---

### Task 7: Verify and Polish

- [ ] **Step 1: Run the dev server and test manually**

Run: `npm run dev`

Test these scenarios:
1. Page loads with all 6 borrowers visible
2. Search by name "Rosario" — shows 1 result
3. Search by borrower code "BRW-2026" — shows all
4. Search by phone "09171" — shows 1 result
5. Click "Active" tab — shows 4 borrowers
6. Click "Inactive" tab — shows 1 borrower (Carmen)
7. Click "Blacklisted" tab — shows 1 borrower (Danilo)
8. Click "Clear" — resets all filters
9. Click a borrower row — detail sheet slides in from right
10. Detail sheet shows contact info, loan summary cards, loan history table
11. Loans column and Outstanding column visible in main table
12. Add Borrower dialog still works
13. Edit/Delete/Toggle actions still work from dropdown menu

- [ ] **Step 2: Fix any issues found during testing**

- [ ] **Step 3: Final commit if any polish changes needed**

```bash
git add -A
git commit -m "fix: polish borrower search and listing UI"
```
