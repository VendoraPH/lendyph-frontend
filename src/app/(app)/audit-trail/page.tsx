"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Download,
  History,
  ArrowRight,
  Monitor,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditLog, AuditAction, AuditModule } from "@/types";

// ── Constants ──

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; color: string }
> = {
  login: { label: "Login", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800" },
  logout: { label: "Logout", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800" },
  created: { label: "Created", color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800" },
  updated: { label: "Updated", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800" },
  deleted: { label: "Deleted", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800" },
  voided: { label: "Voided", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800" },
  released: { label: "Released", color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800" },
  printed: { label: "Printed", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700" },
  reset_password: { label: "Reset Password", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800" },
  status_changed: { label: "Status Changed", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800" },
};

const MODULE_CONFIG: Record<AuditModule, { label: string }> = {
  auth: { label: "Auth" },
  borrowers: { label: "Borrowers" },
  loans: { label: "Loans" },
  payments: { label: "Payments" },
  collections: { label: "Collections" },
  users: { label: "Users" },
  reports: { label: "Reports" },
};

const ACTION_OPTIONS: { value: AuditAction; label: string }[] = [
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "voided", label: "Voided" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "released", label: "Released" },
  { value: "printed", label: "Printed" },
  { value: "reset_password", label: "Reset Password" },
  { value: "status_changed", label: "Status Changed" },
];

const MODULE_OPTIONS: { value: AuditModule; label: string }[] = [
  { value: "auth", label: "Auth" },
  { value: "borrowers", label: "Borrowers" },
  { value: "loans", label: "Loans" },
  { value: "payments", label: "Payments" },
  { value: "collections", label: "Collections" },
  { value: "users", label: "Users" },
  { value: "reports", label: "Reports" },
];

// ── Mock Data ──

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 1,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "login",
    module: "auth",
    description: "Logged in from 192.168.1.10",
    target: null,
    changes: [],
    ip_address: "192.168.1.10",
    created_at: "2026-03-31T14:15:00Z",
  },
  {
    id: 2,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "created",
    module: "borrowers",
    description: 'Created borrower "Juan Dela Cruz"',
    target: { id: 101, type: "borrower", label: "Juan Dela Cruz" },
    changes: [
      { field: "full_name", old: null, new: "Juan Dela Cruz" },
      { field: "phone", old: null, new: "09171234567" },
      { field: "email", old: null, new: "juan@email.com" },
      { field: "address", old: null, new: "123 Main St, Manila" },
      { field: "status", old: null, new: "active" },
    ],
    ip_address: "192.168.1.10",
    created_at: "2026-03-31T14:20:00Z",
  },
  {
    id: 3,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "created",
    module: "loans",
    description: 'Created loan #1024 for "Juan Dela Cruz"',
    target: { id: 1024, type: "loan", label: "Loan #1024" },
    changes: [
      { field: "borrower", old: null, new: "Juan Dela Cruz" },
      { field: "principal_amount", old: null, new: "50,000.00" },
      { field: "interest_rate", old: null, new: "3%" },
      { field: "term_months", old: null, new: "12" },
      { field: "status", old: null, new: "pending" },
    ],
    ip_address: "192.168.1.15",
    created_at: "2026-03-31T13:45:00Z",
  },
  {
    id: 4,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "approved",
    module: "loans",
    description: "Approved loan #1024",
    target: { id: 1024, type: "loan", label: "Loan #1024" },
    changes: [{ field: "status", old: "pending", new: "approved" }],
    ip_address: "192.168.1.15",
    created_at: "2026-03-31T13:50:00Z",
  },
  {
    id: 5,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "released",
    module: "loans",
    description: "Released loan #1024",
    target: { id: 1024, type: "loan", label: "Loan #1024" },
    changes: [{ field: "status", old: "approved", new: "released" }],
    ip_address: "192.168.1.10",
    created_at: "2026-03-31T14:00:00Z",
  },
  {
    id: 6,
    user: { id: 3, full_name: "Juan Dela Cruz", roles: ["cashier"] },
    action: "created",
    module: "payments",
    description: "Recorded payment of \u20B15,000 for loan #1024",
    target: { id: 201, type: "payment", label: "Payment #201" },
    changes: [
      { field: "amount", old: null, new: "5,000.00" },
      { field: "method", old: null, new: "cash" },
      { field: "reference_number", old: null, new: "PAY-20260331-001" },
      { field: "status", old: null, new: "completed" },
    ],
    ip_address: "192.168.1.20",
    created_at: "2026-03-31T10:30:00Z",
  },
  {
    id: 7,
    user: { id: 3, full_name: "Juan Dela Cruz", roles: ["cashier"] },
    action: "voided",
    module: "payments",
    description: "Voided payment #199 — duplicate entry",
    target: { id: 199, type: "payment", label: "Payment #199" },
    changes: [
      { field: "status", old: "completed", new: "voided" },
      { field: "void_reason", old: null, new: "Duplicate entry" },
    ],
    ip_address: "192.168.1.20",
    created_at: "2026-03-31T09:15:00Z",
  },
  {
    id: 8,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "updated",
    module: "borrowers",
    description: 'Updated borrower "Ana Reyes" profile',
    target: { id: 102, type: "borrower", label: "Ana Reyes" },
    changes: [
      { field: "phone", old: "09181234567", new: "09189876543" },
      { field: "address", old: "456 Old St, Cebu", new: "789 New Ave, Cebu" },
    ],
    ip_address: "192.168.1.10",
    created_at: "2026-03-30T16:20:00Z",
  },
  {
    id: 9,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "created",
    module: "users",
    description: 'Created user account "pedro.g"',
    target: { id: 5, type: "user", label: "Pedro Garcia" },
    changes: [
      { field: "name", old: null, new: "Pedro Garcia" },
      { field: "username", old: null, new: "pedro.g" },
      { field: "email", old: null, new: "pedro@lendy.ph" },
      { field: "role", old: null, new: "viewer" },
      { field: "branch", old: null, new: "manila" },
    ],
    ip_address: "192.168.1.10",
    created_at: "2026-03-30T15:00:00Z",
  },
  {
    id: 10,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "status_changed",
    module: "users",
    description: 'Deactivated user "Pedro Garcia"',
    target: { id: 5, type: "user", label: "Pedro Garcia" },
    changes: [{ field: "status", old: "active", new: "inactive" }],
    ip_address: "192.168.1.10",
    created_at: "2026-03-30T15:30:00Z",
  },
  {
    id: 11,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "reset_password",
    module: "users",
    description: 'Reset password for "Maria Santos"',
    target: { id: 2, type: "user", label: "Maria Santos" },
    changes: [],
    ip_address: "192.168.1.10",
    created_at: "2026-03-30T14:45:00Z",
  },
  {
    id: 12,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "rejected",
    module: "loans",
    description: "Rejected loan #1020 — insufficient collateral",
    target: { id: 1020, type: "loan", label: "Loan #1020" },
    changes: [
      { field: "status", old: "pending", new: "rejected" },
      { field: "reject_reason", old: null, new: "Insufficient collateral" },
    ],
    ip_address: "192.168.1.15",
    created_at: "2026-03-30T11:00:00Z",
  },
  {
    id: 13,
    user: { id: 4, full_name: "Ana Reyes", roles: ["collector"] },
    action: "updated",
    module: "collections",
    description: "Marked collection #301 as collected",
    target: { id: 301, type: "collection", label: "Collection #301" },
    changes: [{ field: "status", old: "pending", new: "collected" }],
    ip_address: "192.168.1.25",
    created_at: "2026-03-30T09:30:00Z",
  },
  {
    id: 14,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "printed",
    module: "loans",
    description: "Printed disclosure statement for loan #1024",
    target: { id: 1024, type: "loan", label: "Loan #1024" },
    changes: [],
    ip_address: "192.168.1.15",
    created_at: "2026-03-30T08:00:00Z",
  },
  {
    id: 15,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "printed",
    module: "loans",
    description: "Printed promissory note for loan #1024",
    target: { id: 1024, type: "loan", label: "Loan #1024" },
    changes: [],
    ip_address: "192.168.1.15",
    created_at: "2026-03-30T08:05:00Z",
  },
  {
    id: 16,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "deleted",
    module: "borrowers",
    description: 'Deleted borrower "Test Borrower"',
    target: { id: 999, type: "borrower", label: "Test Borrower" },
    changes: [
      { field: "full_name", old: "Test Borrower", new: null },
      { field: "status", old: "active", new: null },
    ],
    ip_address: "192.168.1.10",
    created_at: "2026-03-29T17:00:00Z",
  },
  {
    id: 17,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "login",
    module: "auth",
    description: "Logged in from 192.168.1.15",
    target: null,
    changes: [],
    ip_address: "192.168.1.15",
    created_at: "2026-03-29T08:00:00Z",
  },
  {
    id: 18,
    user: { id: 2, full_name: "Maria Santos", roles: ["loan_officer"] },
    action: "logout",
    module: "auth",
    description: "Logged out",
    target: null,
    changes: [],
    ip_address: "192.168.1.15",
    created_at: "2026-03-29T17:30:00Z",
  },
  {
    id: 19,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "updated",
    module: "loans",
    description: "Restructured loan #1018 — extended term",
    target: { id: 1018, type: "loan", label: "Loan #1018" },
    changes: [
      { field: "term_months", old: "6", new: "12" },
      { field: "interest_rate", old: "5%", new: "3.5%" },
      { field: "monthly_payment", old: "9,500.00", new: "4,800.00" },
    ],
    ip_address: "192.168.1.10",
    created_at: "2026-03-29T14:00:00Z",
  },
  {
    id: 20,
    user: { id: 1, full_name: "Augustin Maputol", roles: ["admin"] },
    action: "updated",
    module: "users",
    description: 'Updated role for "Ana Reyes"',
    target: { id: 4, type: "user", label: "Ana Reyes" },
    changes: [{ field: "role", old: "viewer", new: "collector" }],
    ip_address: "192.168.1.10",
    created_at: "2026-03-29T10:00:00Z",
  },
];

// ── Helpers ──

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Detail Drawer ──

function AuditDetailDrawer({
  log,
  open,
  onOpenChange,
}: {
  log: AuditLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actionCfg = ACTION_CONFIG[log.action];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-brand-orange" />
            Audit Detail
          </SheetTitle>
          <SheetDescription>
            Event #{log.id} — {formatDate(log.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* User Info */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white text-sm font-semibold">
              {getInitials(log.user.full_name)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">{log.user.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {log.user.roles?.[0].replace("_", " ")}
              </p>
            </div>
          </div>

          {/* Event Summary */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
              Event Summary
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Action</p>
                <Badge variant="outline" className={actionCfg.color}>
                  {actionCfg.label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Module</p>
                <p className="text-sm font-medium">
                  {MODULE_CONFIG[log.module].label}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm">{formatDate(log.created_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm">{formatTime(log.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
              Description
            </h4>
            <p className="text-sm rounded-lg bg-muted/50 p-3">
              {log.description}
            </p>
          </div>

          {/* Target Record */}
          {log.target && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                Target Record
              </h4>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{log.target.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {log.target.type} #{log.target.id}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Changes */}
          {log.changes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                Changes ({log.changes.length} field
                {log.changes.length !== 1 ? "s" : ""})
              </h4>
              <div className="space-y-2">
                {log.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border overflow-hidden"
                  >
                    <div className="bg-muted/50 px-3 py-1.5">
                      <p className="text-xs font-medium capitalize">
                        {change.field.replace("_", " ")}
                      </p>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {change.old !== null && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-100 text-red-600 text-xs font-bold">
                            &minus;
                          </span>
                          <span className="text-red-700 break-all">
                            {change.old}
                          </span>
                        </div>
                      )}
                      {change.new !== null && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-green-100 text-green-600 text-xs font-bold">
                            +
                          </span>
                          <span className="text-green-700 break-all">
                            {change.new}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
              Metadata
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              <span>IP Address: {log.ip_address}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ──

export default function AuditTrailPage() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filteredLogs = MOCK_AUDIT_LOGS.filter((log) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      log.description.toLowerCase().includes(q) ||
      log.user.full_name.toLowerCase().includes(q) ||
      log.module.toLowerCase().includes(q) ||
      (log.target?.label.toLowerCase().includes(q) ?? false);

    const matchesModule =
      moduleFilter === "all" || log.module === moduleFilter;
    const matchesAction =
      actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesModule && matchesAction;
  }).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const hasFilters =
    search || moduleFilter !== "all" || actionFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setModuleFilter("all");
    setActionFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground">
            Track and review all user actions across the system
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold">{MOCK_AUDIT_LOGS.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-2xl font-bold">
              {
                MOCK_AUDIT_LOGS.filter((l) =>
                  l.created_at.startsWith("2026-03-31")
                ).length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Active Users</p>
            <p className="text-2xl font-bold">
              {new Set(MOCK_AUDIT_LOGS.map((l) => l.user.id)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">
              Critical Actions
            </p>
            <p className="text-2xl font-bold text-red-600">
              {
                MOCK_AUDIT_LOGS.filter((l) =>
                  ["deleted", "voided", "rejected"].includes(l.action)
                ).length
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">
            Activity Log ({filteredLogs.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {MODULE_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead className="min-w-[200px]">
                    Description
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action];
                  return (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {formatDate(log.created_at)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(log.created_at)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange text-xs font-semibold">
                            {getInitials(log.user.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {log.user.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {log.user.roles?.[0].replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(actionCfg.color)}
                        >
                          {actionCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {MODULE_CONFIG[log.module].label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {log.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selectedLog && (
        <AuditDetailDrawer
          log={selectedLog}
          open={!!selectedLog}
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null);
          }}
        />
      )}
    </div>
  );
}
