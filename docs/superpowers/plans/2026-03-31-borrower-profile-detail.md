# Borrower Profile Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated borrower profile detail page at `/borrowers/[id]` showing complete personal information, co-maker details, loan history with repayment schedules, payment history, and outstanding balances.

**Architecture:** A dynamic route page (`[id]/page.tsx`) with a header banner and 4 tabbed content sections (Overview, Loans, Payments, Co-Makers). Each tab is its own component. A new `CoMaker` type is added to the type system. Mock data for payments, loan schedules, and co-makers is created to populate the UI. The borrowers list page row click is updated to navigate to the detail page instead of opening the side sheet.

**Tech Stack:** Next.js (App Router, dynamic route), React, TypeScript, Tailwind CSS, lucide-react icons, existing UI components from `@/components/ui/` (Tabs, Table, Card, Badge, Avatar, Separator).

---

## File Structure

```
src/types/
  co-maker.ts                              — new CoMaker interface
  index.ts                                 — add CoMaker export

src/app/(dashboard)/borrowers/[id]/
  page.tsx                                 — main detail page with tabs and state
  _components/
    borrower-header.tsx                    — identity banner with avatar, info, status, actions
    overview-tab.tsx                       — personal, address, employment, loan summary cards
    loans-tab.tsx                          — loans table with expandable repayment schedule
    payments-tab.tsx                       — payment summary cards + payment history table
    co-makers-tab.tsx                      — co-maker cards grouped by loan
    mock-detail-data.ts                    — mock payments, loan schedules, co-makers

src/app/(dashboard)/borrowers/
  page.tsx                                 — modify row click to navigate to /borrowers/[id]
  _components/borrower-detail-sheet.tsx    — remove (replaced by full page)
```

---

### Task 1: Add CoMaker Type and Mock Detail Data

**Files:**
- Create: `src/types/co-maker.ts`
- Modify: `src/types/index.ts`
- Create: `src/app/(dashboard)/borrowers/[id]/_components/mock-detail-data.ts`

- [ ] **Step 1: Create co-maker.ts**

```ts
import type { ValidIdType } from "./borrower";

export interface CoMaker {
  id: number;
  borrower_id: number;
  loan_id: number;
  full_name: string;
  relationship: string;
  phone: string;
  address?: string;
  valid_id_type?: ValidIdType;
  valid_id_number?: string;
  created_at: string;
}
```

- [ ] **Step 2: Add CoMaker export to types/index.ts**

Add to the existing exports:

```ts
export type { CoMaker } from "./co-maker";
```

- [ ] **Step 3: Create mock-detail-data.ts**

This file provides mock data for the detail page: payments, loan schedules, and co-makers. It imports mock loans from the parent `_components/mock-data.ts` and extends them with schedule/payment/co-maker data.

```ts
import type { Payment, LoanSchedule, CoMaker } from "@/types";

// Mock payments keyed by borrower id
export const MOCK_PAYMENTS: Record<number, Payment[]> = {
  1: [
    {
      id: 1001,
      loan_id: 101,
      borrower_id: 1,
      amount: 3933,
      method: "gcash",
      status: "completed",
      reference_number: "GC-20260220-001",
      paid_at: "2026-02-20",
      created_at: "2026-02-20",
      updated_at: "2026-02-20",
    },
    {
      id: 1002,
      loan_id: 101,
      borrower_id: 1,
      amount: 3933,
      method: "gcash",
      status: "completed",
      reference_number: "GC-20260320-002",
      paid_at: "2026-03-20",
      created_at: "2026-03-20",
      updated_at: "2026-03-20",
    },
    {
      id: 1003,
      loan_id: 102,
      borrower_id: 1,
      amount: 5375,
      method: "cash",
      status: "completed",
      collected_by: "Juan Staff",
      paid_at: "2026-03-10",
      created_at: "2026-03-10",
      updated_at: "2026-03-10",
    },
    {
      id: 1004,
      loan_id: 103,
      borrower_id: 1,
      amount: 2800,
      method: "bank_transfer",
      status: "completed",
      reference_number: "BPI-20260315-001",
      paid_at: "2026-03-15",
      created_at: "2026-03-15",
      updated_at: "2026-03-15",
    },
  ],
  2: [
    {
      id: 2001,
      loan_id: 201,
      borrower_id: 2,
      amount: 4708,
      method: "cash",
      status: "completed",
      collected_by: "Maria Staff",
      paid_at: "2025-07-15",
      created_at: "2025-07-15",
      updated_at: "2025-07-15",
    },
    {
      id: 2002,
      loan_id: 203,
      borrower_id: 2,
      amount: 7467,
      method: "maya",
      status: "completed",
      reference_number: "MY-20260220-001",
      paid_at: "2026-02-20",
      created_at: "2026-02-20",
      updated_at: "2026-02-20",
    },
    {
      id: 2003,
      loan_id: 203,
      borrower_id: 2,
      amount: 7467,
      method: "maya",
      status: "completed",
      reference_number: "MY-20260320-002",
      paid_at: "2026-03-20",
      created_at: "2026-03-20",
      updated_at: "2026-03-20",
    },
    {
      id: 2004,
      loan_id: 204,
      borrower_id: 2,
      amount: 4542,
      method: "cash",
      status: "completed",
      collected_by: "Juan Staff",
      paid_at: "2026-03-01",
      created_at: "2026-03-01",
      updated_at: "2026-03-01",
    },
  ],
  3: [
    {
      id: 3001,
      loan_id: 301,
      borrower_id: 3,
      amount: 3633,
      method: "gcash",
      status: "completed",
      reference_number: "GC-20260401-001",
      paid_at: "2026-03-30",
      created_at: "2026-03-30",
      updated_at: "2026-03-30",
    },
  ],
  4: [
    {
      id: 4001,
      loan_id: 401,
      borrower_id: 4,
      amount: 9417,
      method: "bank_transfer",
      status: "completed",
      reference_number: "BDO-20250601-001",
      paid_at: "2025-06-01",
      created_at: "2025-06-01",
      updated_at: "2025-06-01",
    },
    {
      id: 4002,
      loan_id: 402,
      borrower_id: 4,
      amount: 9583,
      method: "bank_transfer",
      status: "completed",
      reference_number: "BDO-20260301-001",
      paid_at: "2026-03-01",
      created_at: "2026-03-01",
      updated_at: "2026-03-01",
    },
    {
      id: 4003,
      loan_id: 402,
      borrower_id: 4,
      amount: 9583,
      method: "bank_transfer",
      status: "pending",
      reference_number: "BDO-20260401-001",
      created_at: "2026-03-28",
      updated_at: "2026-03-28",
    },
  ],
  5: [],
  6: [
    {
      id: 6001,
      loan_id: 601,
      borrower_id: 6,
      amount: 8667,
      method: "cash",
      status: "completed",
      collected_by: "Maria Staff",
      paid_at: "2025-11-01",
      created_at: "2025-11-01",
      updated_at: "2025-11-01",
    },
    {
      id: 6002,
      loan_id: 601,
      borrower_id: 6,
      amount: 8667,
      method: "cash",
      status: "completed",
      collected_by: "Maria Staff",
      paid_at: "2025-12-01",
      created_at: "2025-12-01",
      updated_at: "2025-12-01",
    },
  ],
};

// Mock loan schedules keyed by loan id
export const MOCK_SCHEDULES: Record<number, LoanSchedule[]> = {
  102: [
    { id: 1, loan_id: 102, due_date: "2026-03-10", principal: 5000, interest: 375, amount_due: 5375, amount_paid: 5375, balance: 0, status: "paid" },
    { id: 2, loan_id: 102, due_date: "2026-04-10", principal: 5000, interest: 375, amount_due: 5375, amount_paid: 0, balance: 5375, status: "pending" },
    { id: 3, loan_id: 102, due_date: "2026-05-10", principal: 5000, interest: 375, amount_due: 5375, amount_paid: 0, balance: 5375, status: "pending" },
  ],
  103: [
    { id: 4, loan_id: 103, due_date: "2026-04-01", principal: 2500, interest: 300, amount_due: 2800, amount_paid: 2800, balance: 0, status: "paid" },
    { id: 5, loan_id: 103, due_date: "2026-05-01", principal: 2500, interest: 300, amount_due: 2800, amount_paid: 0, balance: 2800, status: "pending" },
    { id: 6, loan_id: 103, due_date: "2026-06-01", principal: 2500, interest: 300, amount_due: 2800, amount_paid: 0, balance: 2800, status: "pending" },
    { id: 7, loan_id: 103, due_date: "2026-07-01", principal: 2500, interest: 300, amount_due: 2800, amount_paid: 0, balance: 2800, status: "pending" },
  ],
  203: [
    { id: 8, loan_id: 203, due_date: "2026-02-20", principal: 6667, interest: 800, amount_due: 7467, amount_paid: 7467, balance: 0, status: "paid" },
    { id: 9, loan_id: 203, due_date: "2026-03-20", principal: 6667, interest: 800, amount_due: 7467, amount_paid: 7467, balance: 0, status: "paid" },
    { id: 10, loan_id: 203, due_date: "2026-04-20", principal: 6667, interest: 800, amount_due: 7467, amount_paid: 0, balance: 7467, status: "pending" },
    { id: 11, loan_id: 203, due_date: "2026-05-20", principal: 6667, interest: 800, amount_due: 7467, amount_paid: 0, balance: 7467, status: "pending" },
    { id: 12, loan_id: 203, due_date: "2026-06-20", principal: 6666, interest: 800, amount_due: 7466, amount_paid: 0, balance: 7466, status: "pending" },
    { id: 13, loan_id: 203, due_date: "2026-07-20", principal: 6666, interest: 800, amount_due: 7466, amount_paid: 0, balance: 7466, status: "pending" },
  ],
  301: [
    { id: 14, loan_id: 301, due_date: "2026-04-01", principal: 3333, interest: 300, amount_due: 3633, amount_paid: 3633, balance: 0, status: "paid" },
    { id: 15, loan_id: 301, due_date: "2026-05-01", principal: 3333, interest: 300, amount_due: 3633, amount_paid: 0, balance: 3633, status: "pending" },
    { id: 16, loan_id: 301, due_date: "2026-06-01", principal: 3334, interest: 300, amount_due: 3634, amount_paid: 0, balance: 3634, status: "pending" },
  ],
  402: [
    { id: 17, loan_id: 402, due_date: "2026-03-01", principal: 8333, interest: 1250, amount_due: 9583, amount_paid: 9583, balance: 0, status: "paid" },
    { id: 18, loan_id: 402, due_date: "2026-04-01", principal: 8333, interest: 1250, amount_due: 9583, amount_paid: 0, balance: 9583, status: "pending" },
    { id: 19, loan_id: 402, due_date: "2026-05-01", principal: 8333, interest: 1250, amount_due: 9583, amount_paid: 0, balance: 9583, status: "pending" },
    { id: 20, loan_id: 402, due_date: "2026-06-01", principal: 8333, interest: 1250, amount_due: 9583, amount_paid: 0, balance: 9583, status: "pending" },
    { id: 21, loan_id: 402, due_date: "2026-07-01", principal: 8334, interest: 1250, amount_due: 9584, amount_paid: 0, balance: 9584, status: "pending" },
    { id: 22, loan_id: 402, due_date: "2026-08-01", principal: 8334, interest: 1250, amount_due: 9584, amount_paid: 0, balance: 9584, status: "pending" },
  ],
  601: [
    { id: 23, loan_id: 601, due_date: "2025-11-01", principal: 6667, interest: 2000, amount_due: 8667, amount_paid: 8667, balance: 0, status: "paid" },
    { id: 24, loan_id: 601, due_date: "2025-12-01", principal: 6667, interest: 2000, amount_due: 8667, amount_paid: 8667, balance: 0, status: "paid" },
    { id: 25, loan_id: 601, due_date: "2026-01-01", principal: 6667, interest: 2000, amount_due: 8667, amount_paid: 0, balance: 8667, status: "overdue" },
    { id: 26, loan_id: 601, due_date: "2026-02-01", principal: 6667, interest: 2000, amount_due: 8667, amount_paid: 0, balance: 8667, status: "overdue" },
    { id: 27, loan_id: 601, due_date: "2026-03-01", principal: 6667, interest: 2000, amount_due: 8667, amount_paid: 0, balance: 8667, status: "overdue" },
    { id: 28, loan_id: 601, due_date: "2026-04-01", principal: 6665, interest: 2000, amount_due: 8665, amount_paid: 0, balance: 8665, status: "pending" },
  ],
};

// Mock co-makers keyed by borrower id
export const MOCK_CO_MAKERS: Record<number, CoMaker[]> = {
  1: [
    {
      id: 1,
      borrower_id: 1,
      loan_id: 102,
      full_name: "Ricardo Santos",
      relationship: "Spouse",
      phone: "09171234568",
      address: "123 Rizal St., San Antonio, Makati, Metro Manila",
      valid_id_type: "philippine_id",
      valid_id_number: "9876-5432-1098-7654",
      created_at: "2026-02-10",
    },
  ],
  2: [
    {
      id: 2,
      borrower_id: 2,
      loan_id: 203,
      full_name: "Elena Garcia",
      relationship: "Spouse",
      phone: "09181234568",
      address: "45 Mabini Ave., Poblacion, Cebu City",
      valid_id_type: "voters_id",
      valid_id_number: "VIN-2345678",
      created_at: "2026-01-20",
    },
    {
      id: 3,
      borrower_id: 2,
      loan_id: 204,
      full_name: "Pedro Garcia",
      relationship: "Brother",
      phone: "09181234569",
      address: "50 Mabini Ave., Poblacion, Cebu City",
      valid_id_type: "drivers_license",
      valid_id_number: "N02-12-345679",
      created_at: "2026-02-15",
    },
  ],
  3: [],
  4: [
    {
      id: 4,
      borrower_id: 4,
      loan_id: 402,
      full_name: "Gloria Mendoza",
      relationship: "Sister",
      phone: "09201234568",
      address: "14 Aguinaldo Rd., San Isidro, Malolos, Bulacan",
      valid_id_type: "sss",
      valid_id_number: "34-7654321-0",
      created_at: "2026-02-01",
    },
  ],
  5: [],
  6: [
    {
      id: 5,
      borrower_id: 6,
      loan_id: 601,
      full_name: "Rosa Villanueva",
      relationship: "Spouse",
      phone: "09221234568",
      address: "33 Quezon Blvd., Sampaguita, Angeles City, Pampanga",
      valid_id_type: "umid",
      valid_id_number: "0012-3456790-0",
      created_at: "2025-10-01",
    },
  ],
};
```

- [ ] **Step 4: Commit**

```bash
git add src/types/co-maker.ts src/types/index.ts src/app/\(dashboard\)/borrowers/\[id\]/_components/mock-detail-data.ts
git commit -m "feat: add CoMaker type and mock detail data for borrower profile"
```

---

### Task 2: Borrower Header Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/_components/borrower-header.tsx`

- [ ] **Step 1: Create borrower-header.tsx**

A banner component showing the borrower's identity at the top of the detail page.

```tsx
"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import type { Borrower } from "@/types";
import { statusBadgeColor, getInitials, formatCurrency } from "../../_components/utils";

interface BorrowerHeaderProps {
  borrower: Borrower;
  onEdit: () => void;
}

export function BorrowerHeader({ borrower, onEdit }: BorrowerHeaderProps) {
  const details = [
    borrower.gender === "male" ? "Male" : "Female",
    borrower.civil_status?.charAt(0).toUpperCase() + borrower.civil_status?.slice(1),
    borrower.birthdate
      ? `${new Date().getFullYear() - new Date(borrower.birthdate).getFullYear()} yrs old`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <Link
        href="/borrowers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Borrowers
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {borrower.photo ? (
              <AvatarImage src={borrower.photo} alt={borrower.full_name} />
            ) : null}
            <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xl font-semibold">
              {getInitials(borrower.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {borrower.full_name}
              </h1>
              <Badge
                variant="outline"
                className={statusBadgeColor[borrower.status]}
              >
                {borrower.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {borrower.borrower_code}
            </p>
            <p className="text-sm text-muted-foreground">{details}</p>
            <p className="text-sm text-muted-foreground">
              {borrower.phone}
              {borrower.email ? ` · ${borrower.email}` : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={onEdit}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit Profile
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/borrower-header.tsx
git commit -m "feat: add borrower header component with identity banner"
```

---

### Task 3: Overview Tab Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/_components/overview-tab.tsx`

- [ ] **Step 1: Create overview-tab.tsx**

Four information cards: Personal Details, Address, Employment, Loan Summary.

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  MapPin,
  Briefcase,
  CreditCard,
} from "lucide-react";
import type { Borrower, Loan } from "@/types";
import { formatCurrency, formatDate } from "../../_components/utils";
import { VALID_ID_OPTIONS } from "@/constants";

interface OverviewTabProps {
  borrower: Borrower;
  loans: Loan[];
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function OverviewTab({ borrower, loans }: OverviewTabProps) {
  const ongoingLoans = loans.filter((l) => l.status === "ongoing").length;
  const completedLoans = loans.filter((l) => l.status === "completed").length;
  const defaultedLoans = loans.filter((l) => l.status === "defaulted").length;
  const totalOutstanding = loans.reduce(
    (sum, l) => sum + l.outstanding_balance,
    0
  );
  const totalPrincipal = loans.reduce(
    (sum, l) => sum + l.principal_amount,
    0
  );

  const idLabel =
    VALID_ID_OPTIONS.find((o) => o.value === borrower.valid_id_type)?.label ??
    borrower.valid_id_type;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Personal Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-muted-foreground" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoItem label="Full Name" value={borrower.full_name} />
          <InfoItem
            label="Birthdate"
            value={borrower.birthdate ? formatDate(borrower.birthdate) : undefined}
          />
          <InfoItem
            label="Gender"
            value={borrower.gender === "male" ? "Male" : "Female"}
          />
          <InfoItem
            label="Civil Status"
            value={
              borrower.civil_status
                ? borrower.civil_status.charAt(0).toUpperCase() +
                  borrower.civil_status.slice(1)
                : undefined
            }
          />
          <InfoItem label="Valid ID" value={idLabel} />
          <InfoItem label="ID Number" value={borrower.valid_id_number} />
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoItem label="Street Address" value={borrower.address} />
          <InfoItem label="Barangay" value={borrower.barangay} />
          <InfoItem label="City / Municipality" value={borrower.city} />
          <InfoItem label="Province" value={borrower.province} />
          <InfoItem label="Zip Code" value={borrower.zip_code} />
          <InfoItem label="Phone" value={borrower.phone} />
        </CardContent>
      </Card>

      {/* Employment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Employment & Income
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoItem
            label="Employment Type"
            value={
              borrower.employment_type
                ? borrower.employment_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : undefined
            }
          />
          <InfoItem label="Employer / Business" value={borrower.employer_or_business} />
          <InfoItem
            label="Monthly Income"
            value={
              borrower.monthly_income
                ? formatCurrency(borrower.monthly_income)
                : undefined
            }
          />
        </CardContent>
      </Card>

      {/* Loan Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Loan Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Loans</p>
              <p className="text-2xl font-bold">{loans.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Borrowed</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalPrincipal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-brand-orange">
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ongoing / Completed / Defaulted</p>
              <p className="text-2xl font-bold">
                <span className="text-green-600">{ongoingLoans}</span>
                {" / "}
                <span className="text-gray-600">{completedLoans}</span>
                {" / "}
                <span className="text-red-600">{defaultedLoans}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/overview-tab.tsx
git commit -m "feat: add overview tab with personal, address, employment, and loan summary"
```

---

### Task 4: Loans Tab Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/_components/loans-tab.tsx`

- [ ] **Step 1: Create loans-tab.tsx**

Table of all loans with expandable rows showing repayment schedule.

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Loan, LoanSchedule } from "@/types";
import { formatCurrency, formatDate } from "../../_components/utils";
import { LOAN_STATUS_LABELS, PAYMENT_FREQUENCY_LABELS } from "@/constants";
import { MOCK_SCHEDULES } from "./mock-detail-data";

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

const scheduleStatusColor: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};

interface LoansTabProps {
  loans: Loan[];
}

function ScheduleTable({ schedule }: { schedule: LoanSchedule[] }) {
  return (
    <div className="rounded-lg border bg-muted/30 mx-4 mb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Due Date</TableHead>
            <TableHead className="text-xs text-right">Principal</TableHead>
            <TableHead className="text-xs text-right">Interest</TableHead>
            <TableHead className="text-xs text-right">Amount Due</TableHead>
            <TableHead className="text-xs text-right">Paid</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-sm">{formatDate(s.due_date)}</TableCell>
              <TableCell className="text-sm text-right tabular-nums">
                {formatCurrency(s.principal)}
              </TableCell>
              <TableCell className="text-sm text-right tabular-nums">
                {formatCurrency(s.interest)}
              </TableCell>
              <TableCell className="text-sm text-right tabular-nums font-medium">
                {formatCurrency(s.amount_due)}
              </TableCell>
              <TableCell className="text-sm text-right tabular-nums">
                {formatCurrency(s.amount_paid)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={scheduleStatusColor[s.status]}>
                  {s.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function LoansTab({ loans }: LoansTabProps) {
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);

  // Sort: ongoing first, then defaulted, then completed
  const sortedLoans = [...loans].sort((a, b) => {
    const order: Record<string, number> = {
      ongoing: 0,
      defaulted: 1,
      pending: 2,
      approved: 3,
      released: 4,
      restructured: 5,
      completed: 6,
      rejected: 7,
    };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Released</TableHead>
                <TableHead>Maturity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLoans.map((loan) => {
                const schedule = MOCK_SCHEDULES[loan.id] ?? [];
                const hasSchedule = schedule.length > 0;
                const isExpanded = expandedLoan === loan.id;

                return (
                  <>
                    <TableRow
                      key={loan.id}
                      className={hasSchedule ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => {
                        if (hasSchedule) {
                          setExpandedLoan(isExpanded ? null : loan.id);
                        }
                      }}
                    >
                      <TableCell>
                        {hasSchedule &&
                          (isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                      <TableCell className="font-medium">
                        {loan.purpose || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(loan.principal_amount)}
                      </TableCell>
                      <TableCell>{loan.interest_rate}%</TableCell>
                      <TableCell>
                        {loan.term_months}mo ·{" "}
                        {PAYMENT_FREQUENCY_LABELS[loan.payment_frequency] ?? loan.payment_frequency}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-brand-orange">
                        {loan.outstanding_balance > 0
                          ? formatCurrency(loan.outstanding_balance)
                          : "Paid"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {loan.released_at ? formatDate(loan.released_at) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {loan.maturity_date ? formatDate(loan.maturity_date) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={loanStatusColor[loan.status]}
                        >
                          {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasSchedule && (
                      <TableRow key={`${loan.id}-schedule`}>
                        <TableCell colSpan={9} className="p-0">
                          <ScheduleTable schedule={schedule} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No loans found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/loans-tab.tsx
git commit -m "feat: add loans tab with expandable repayment schedules"
```

---

### Task 5: Payments Tab Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/_components/payments-tab.tsx`

- [ ] **Step 1: Create payments-tab.tsx**

Payment summary cards + payment history table.

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Banknote, CalendarClock, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Payment, Loan } from "@/types";
import { formatCurrency, formatDate } from "../../_components/utils";

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

const paymentStatusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  voided: "bg-red-100 text-red-700 border-red-200",
};

interface PaymentsTabProps {
  payments: Payment[];
  loans: Loan[];
}

export function PaymentsTab({ payments, loans }: PaymentsTabProps) {
  const completedPayments = payments.filter((p) => p.status === "completed");
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = loans.reduce(
    (sum, l) => sum + l.outstanding_balance,
    0
  );
  const totalPayable = loans.reduce((sum, l) => sum + l.total_payable, 0);

  // Find the next due date from ongoing loans
  const ongoingLoans = loans.filter((l) => l.status === "ongoing");
  const nextDueDates = ongoingLoans
    .map((l) => l.next_due_date)
    .filter(Boolean)
    .sort();
  const nextDueDate = nextDueDates[0];

  // Overdue: loans with next_due_date in the past
  const today = new Date().toISOString().split("T")[0]!;
  const overdueLoans = ongoingLoans.filter(
    (l) => l.next_due_date && l.next_due_date < today
  );
  const overdueAmount = overdueLoans.reduce(
    (sum, l) => sum + l.outstanding_balance,
    0
  );

  // Sort payments by date descending
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.paid_at ?? a.created_at;
    const dateB = b.paid_at ?? b.created_at;
    return dateB.localeCompare(dateA);
  });

  // Map loan_id to loan purpose for display
  const loanPurposeMap = new Map(loans.map((l) => [l.id, l.purpose ?? `Loan #${l.id}`]));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Remaining Balance</p>
                <p className="text-2xl font-bold text-brand-orange">
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-brand-orange/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Next Due Date</p>
                <p className="text-2xl font-bold">
                  {nextDueDate ? formatDate(nextDueDate) : "—"}
                </p>
              </div>
              <CalendarClock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className={`text-2xl font-bold ${overdueAmount > 0 ? "text-red-600" : ""}`}>
                  {overdueAmount > 0 ? formatCurrency(overdueAmount) : "None"}
                </p>
              </div>
              <AlertCircle className={`h-8 w-8 ${overdueAmount > 0 ? "text-red-600/30" : "text-muted-foreground/30"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Payment History ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {formatDate(payment.paid_at ?? payment.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {loanPurposeMap.get(payment.loan_id) ?? `Loan #${payment.loan_id}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(payment.amount)}
                      {payment.penalty_amount ? (
                        <span className="text-xs text-red-500 ml-1">
                          (+{formatCurrency(payment.penalty_amount)} penalty)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {paymentMethodLabels[payment.method] ?? payment.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {payment.reference_number || payment.collected_by || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={paymentStatusColor[payment.status]}
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No payments recorded.
                    </TableCell>
                  </TableRow>
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

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/payments-tab.tsx
git commit -m "feat: add payments tab with summary cards and payment history"
```

---

### Task 6: Co-Makers Tab Component

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/_components/co-makers-tab.tsx`

- [ ] **Step 1: Create co-makers-tab.tsx**

Co-maker cards grouped by loan.

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, CreditCard, Users } from "lucide-react";
import type { CoMaker, Loan } from "@/types";
import { VALID_ID_OPTIONS } from "@/constants";
import { formatCurrency } from "../../_components/utils";

interface CoMakersTabProps {
  coMakers: CoMaker[];
  loans: Loan[];
}

export function CoMakersTab({ coMakers, loans }: CoMakersTabProps) {
  const loanMap = new Map(loans.map((l) => [l.id, l]));

  if (coMakers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No co-makers on file for this borrower.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {coMakers.map((cm) => {
        const loan = loanMap.get(cm.loan_id);
        const idLabel =
          VALID_ID_OPTIONS.find((o) => o.value === cm.valid_id_type)?.label ??
          cm.valid_id_type;

        return (
          <Card key={cm.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{cm.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {cm.relationship}
                  </p>
                </div>
                {loan && (
                  <Badge variant="outline" className="text-xs">
                    {loan.purpose ?? `Loan #${loan.id}`} ·{" "}
                    {formatCurrency(loan.principal_amount)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {cm.phone}
              </div>
              {cm.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  {cm.address}
                </div>
              )}
              {cm.valid_id_type && (
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {idLabel}
                  {cm.valid_id_number && (
                    <span className="text-muted-foreground font-mono text-xs">
                      {cm.valid_id_number}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/co-makers-tab.tsx
git commit -m "feat: add co-makers tab with loan-linked guarantor cards"
```

---

### Task 7: Main Detail Page

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/page.tsx`

- [ ] **Step 1: Create page.tsx**

The main detail page that composes all tabs.

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Borrower } from "@/types";
import { INITIAL_BORROWERS } from "../_components/mock-data";
import { MOCK_LOANS } from "../_components/mock-data";
import { MOCK_PAYMENTS, MOCK_CO_MAKERS } from "./_components/mock-detail-data";
import { BorrowerHeader } from "./_components/borrower-header";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { CoMakersTab } from "./_components/co-makers-tab";
import { EditBorrowerDialog } from "../_components/borrower-actions";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = Number(params.id);

  const [borrower, setBorrower] = useState<Borrower | undefined>(() =>
    INITIAL_BORROWERS.find((b) => b.id === borrowerId)
  );
  const [editOpen, setEditOpen] = useState(false);

  if (!borrower) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Borrower not found.</p>
      </div>
    );
  }

  const loans = MOCK_LOANS[borrower.id] ?? [];
  const payments = MOCK_PAYMENTS[borrower.id] ?? [];
  const coMakers = MOCK_CO_MAKERS[borrower.id] ?? [];

  return (
    <div className="space-y-6">
      <BorrowerHeader
        borrower={borrower}
        onEdit={() => setEditOpen(true)}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">
            Loans ({loans.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="co-makers">
            Co-Makers ({coMakers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab borrower={borrower} loans={loans} />
        </TabsContent>

        <TabsContent value="loans" className="pt-4">
          <LoansTab loans={loans} />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <PaymentsTab payments={payments} loans={loans} />
        </TabsContent>

        <TabsContent value="co-makers" className="pt-4">
          <CoMakersTab coMakers={coMakers} loans={loans} />
        </TabsContent>
      </Tabs>

      <EditBorrowerDialog
        borrower={borrower}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(updated) => {
          setBorrower(updated);
          setEditOpen(false);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/page.tsx
git commit -m "feat: add borrower detail page composing all tab components"
```

---

### Task 8: Update Borrowers List to Navigate to Detail Page

**Files:**
- Modify: `src/app/(dashboard)/borrowers/page.tsx`
- Modify: `src/app/(dashboard)/borrowers/_components/borrower-table.tsx`

- [ ] **Step 1: Update borrower-table.tsx to use router navigation**

Change `onRowClick` to navigate to `/borrowers/[id]` instead of opening the sheet.

Replace the click handler import and add router:

```tsx
// At the top, add:
import { useRouter } from "next/navigation";

// Change the interface — remove onRowClick:
interface BorrowerTableProps {
  borrowers: Borrower[];
  onEdit: (updated: Borrower) => void;
  onToggleStatus: (id: number) => void;
  onDelete: (id: number) => void;
}

// Inside the component, add router:
export function BorrowerTable({
  borrowers,
  onEdit,
  onToggleStatus,
  onDelete,
}: BorrowerTableProps) {
  const router = useRouter();

  // Change the TableRow onClick to:
  onClick={() => router.push(`/borrowers/${borrower.id}`)}
```

- [ ] **Step 2: Update page.tsx to remove sheet references**

Remove the detail sheet import, state (`selectedBorrower`, `detailOpen`), `handleRowClick`, and the `<BorrowerDetailSheet>` component from page.tsx.

Remove the `onRowClick` prop from `<BorrowerTable>`.

Remove the import for `BorrowerDetailSheet`.

The updated page.tsx should have these changes:
- Remove: `import { BorrowerDetailSheet } from "./_components/borrower-detail-sheet";`
- Remove: `const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);`
- Remove: `const [detailOpen, setDetailOpen] = useState(false);`
- Remove: the entire `handleRowClick` function
- Remove: the `selectedBorrower` update in `handleEdit`
- Remove: the `selectedBorrower`/`detailOpen` cleanup in `handleDelete`
- Remove: the `onRowClick={handleRowClick}` prop from `<BorrowerTable>`
- Remove: the entire `<BorrowerDetailSheet>` JSX block

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/page.tsx src/app/\(dashboard\)/borrowers/_components/borrower-table.tsx
git commit -m "feat: navigate to borrower detail page on row click, remove detail sheet"
```

---

### Task 9: Build Check and Polish

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with `/borrowers/[id]` route in the output

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix: polish borrower detail page"
```
