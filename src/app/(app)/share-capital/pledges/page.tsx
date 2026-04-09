"use client";

import React, { useState, useMemo } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Settings2,
  PlusCircle,
  Check,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

// Mock data — replace with API integration
const INITIAL_PLEDGES = [
  { id: 1, borrower: "Rosario D. Santos", amount: 500, schedule: "15/30" as const, autoCredit: true },
  { id: 2, borrower: "Roberto Garcia", amount: 1000, schedule: "15/30" as const, autoCredit: true },
  { id: 3, borrower: "Eduardo Mendoza", amount: 500, schedule: "30" as const, autoCredit: true },
  { id: 4, borrower: "Maria L. Reyes", amount: 500, schedule: "15/30" as const, autoCredit: false },
  { id: 5, borrower: "Ana Santos", amount: 1000, schedule: "15" as const, autoCredit: true },
  { id: 6, borrower: "Carmen Torres", amount: 500, schedule: "30" as const, autoCredit: false },
  { id: 7, borrower: "Jose P. Dela Cruz", amount: 750, schedule: "15" as const, autoCredit: true },
  { id: 8, borrower: "Lorna M. Bautista", amount: 300, schedule: "30" as const, autoCredit: false },
  { id: 9, borrower: "Miguel A. Ramos", amount: 1500, schedule: "15/30" as const, autoCredit: true },
  { id: 10, borrower: "Patricia V. Cruz", amount: 600, schedule: "15" as const, autoCredit: true },
  { id: 11, borrower: "Fernando S. Lopez", amount: 800, schedule: "30" as const, autoCredit: false },
  { id: 12, borrower: "Gloria T. Navarro", amount: 400, schedule: "15/30" as const, autoCredit: true },
];

const SCHEDULE_OPTIONS = [
  { value: "15", label: "Every 15th" },
  { value: "30", label: "Every 30th" },
  { value: "15/30", label: "Every 15th & 30th" },
];

const PAGE_SIZES = [5, 10, 20];

type SortField = "borrower" | "amount" | "schedule" | "autoCredit";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-brand-orange" />
    : <ArrowDown className="h-3.5 w-3.5 ml-1 text-brand-orange" />;
}

export default function PledgeEntryPage() {
  const [pledges, setPledges] = useState(INITIAL_PLEDGES);
  const [search, setSearch] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Filters
  const [filterSchedule, setFilterSchedule] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inline editing state
  const [editingAmountId, setEditingAmountId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editSchedule, setEditSchedule] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Manual entry (individual)
  const [manualEntryId, setManualEntryId] = useState<number | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [manualTransaction, setManualTransaction] = useState<"credit" | "debit">("credit");

  // Per-member bulk entry dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<Record<number, { amount: string; transaction: "credit" | "debit" }>>({});

  // ── Derived data ──

  const activeCount = pledges.filter((p) => p.autoCredit).length;
  const totalPledge = pledges.reduce((sum, p) => sum + p.amount, 0);

  const processed = useMemo(() => {
    let result = [...pledges];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.borrower.toLowerCase().includes(q));
    }

    // Filter by schedule
    if (filterSchedule !== "all") {
      result = result.filter((p) => p.schedule === filterSchedule);
    }

    // Filter by auto-credit status
    if (filterStatus !== "all") {
      result = result.filter((p) =>
        filterStatus === "active" ? p.autoCredit : !p.autoCredit
      );
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "borrower":
            cmp = a.borrower.localeCompare(b.borrower);
            break;
          case "amount":
            cmp = a.amount - b.amount;
            break;
          case "schedule":
            cmp = a.schedule.localeCompare(b.schedule);
            break;
          case "autoCredit":
            cmp = Number(a.autoCredit) - Number(b.autoCredit);
            break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [pledges, search, filterSchedule, filterStatus, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = processed.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Handlers ──

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleToggleAutoCredit(id: number) {
    setPledges((prev) =>
      prev.map((p) => (p.id === id ? { ...p, autoCredit: !p.autoCredit } : p))
    );
    const pledge = pledges.find((p) => p.id === id);
    if (pledge) {
      toast.success(
        pledge.autoCredit
          ? `Auto-credit deactivated for ${pledge.borrower}`
          : `Auto-credit activated for ${pledge.borrower}`
      );
    }
  }

  function startAmountEdit(pledge: { id: number; amount: number }) {
    setEditingAmountId(pledge.id);
    setEditAmount(String(pledge.amount));
  }

  function saveAmountEdit(id: number) {
    const newAmount = Math.round(parseFloat(editAmount) || 0);
    if (newAmount <= 0) {
      toast.error("Pledge amount must be greater than 0");
      return;
    }
    setPledges((prev) =>
      prev.map((p) => (p.id === id ? { ...p, amount: newAmount } : p))
    );
    setEditingAmountId(null);
    toast.success("Pledge amount updated");
  }

  function cancelAmountEdit() {
    setEditingAmountId(null);
    setEditAmount("");
  }

  function startScheduleEdit(pledge: { id: number; schedule: string }) {
    setEditingScheduleId(pledge.id);
    setEditSchedule(pledge.schedule);
  }

  function saveScheduleEdit(id: number, newSchedule: string) {
    setPledges((prev) =>
      prev.map((p) => (p.id === id ? { ...p, schedule: newSchedule as "15" | "30" | "15/30" } : p))
    );
    setEditingScheduleId(null);
    toast.success("Schedule updated");
  }

  function startManualEntry(id: number) {
    setManualEntryId(id);
    setManualAmount("");
    setManualTransaction("credit");
  }

  function handleManualEntry(id: number) {
    const amount = Math.round(parseFloat(manualAmount) || 0);
    if (amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    const pledge = pledges.find((p) => p.id === id);
    if (pledge) {
      toast.success(
        `Manual ${manualTransaction} of ${formatCurrency(amount)} for ${pledge.borrower}`
      );
    }
    setManualEntryId(null);
    setManualAmount("");
    setManualTransaction("credit");
  }

  // Selection helpers
  const allPageSelected = paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id));
  const somePageSelected = paginated.some((p) => selectedIds.has(p.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setBulkEntries((e) => { const { [id]: _, ...rest } = e; return rest; });
      } else {
        next.add(id);
        setBulkEntries((e) => ({ ...e, [id]: { amount: "", transaction: "credit" } }));
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        setBulkEntries((e) => {
          const rest = { ...e };
          for (const p of paginated) { next.delete(p.id); delete rest[p.id]; }
          return rest;
        });
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        setBulkEntries((e) => {
          const updated = { ...e };
          for (const p of paginated) { next.add(p.id); if (!updated[p.id]) updated[p.id] = { amount: "", transaction: "credit" }; }
          return updated;
        });
        return next;
      });
    }
  }

  function updateBulkEntry(id: number, field: "amount" | "transaction", value: string) {
    setBulkEntries((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function handleBulkSubmit() {
    const entries = Object.entries(bulkEntries).filter(
      ([id]) => selectedIds.has(Number(id))
    );
    const valid = entries.filter(([, e]) => Math.round(parseFloat(e.amount) || 0) > 0);
    if (valid.length === 0) {
      toast.error("Enter an amount for at least one member");
      return;
    }
    for (const [id, entry] of valid) {
      const pledge = pledges.find((p) => p.id === Number(id));
      if (pledge) {
        toast.success(
          `${entry.transaction === "credit" ? "Credit" : "Debit"} of ${formatCurrency(Math.round(parseFloat(entry.amount)))} for ${pledge.borrower}`
        );
      }
    }
    setSelectedIds(new Set());
    setBulkEntries({});
  }

  return (
    <RouteGuard permission="share_capital:view" pageName="Pledge Entry">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pledge Entry</h1>
          <p className="text-muted-foreground">
            Configure share capital pledges for members
          </p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Pledges</span>
                <span className="text-2xl font-bold">{pledges.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Active Auto-Credit</span>
                <span className="text-2xl font-bold text-green-600">{activeCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-brand-orange">{formatCurrency(totalPledge)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Entry Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-4 py-3">
            <span className="text-sm font-medium">
              {selectedIds.size} member{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <Button
              size="sm"
              className="h-8 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={() => setBulkDialogOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              Manual Entry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setSelectedIds(new Set()); setBulkEntries({}); }}
            >
              Clear
            </Button>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium">
                All Pledges
                <span className="text-muted-foreground font-normal ml-1">({processed.length})</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search member..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9 w-48 h-8 text-sm"
                  />
                </div>
                {/* Filter: Schedule */}
                <Select value={filterSchedule} onValueChange={(v) => { setFilterSchedule(v as string); setPage(1); }}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue>
                      {(value: string | null) =>
                        value === "all" ? "All Schedules" : (SCHEDULE_OPTIONS.find((s) => s.value === value)?.label ?? value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schedules</SelectItem>
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Filter: Status */}
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as string); setPage(1); }}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue>
                      {(value: string | null) =>
                        value === "all" ? "All Status" : value === "active" ? "Active" : "Inactive"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected && !allPageSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => toggleSort("borrower")}
                    >
                      <span className="flex items-center">
                        Member
                        <SortIcon field="borrower" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => toggleSort("amount")}
                    >
                      <span className="flex items-center">
                        Pledge Amount
                        <SortIcon field="amount" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => toggleSort("schedule")}
                    >
                      <span className="flex items-center">
                        Schedule
                        <SortIcon field="schedule" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => toggleSort("autoCredit")}
                    >
                      <span className="flex items-center">
                        Auto-Credit
                        <SortIcon field="autoCredit" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((pledge) => (
                    <React.Fragment key={pledge.id}>
                      <TableRow>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(pledge.id)}
                            onCheckedChange={() => toggleSelect(pledge.id)}
                            aria-label={`Select ${pledge.borrower}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{pledge.borrower}</TableCell>
                        <TableCell>
                          {editingAmountId === pledge.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                step="1"
                                autoFocus
                                className="w-28 h-8 text-sm"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveAmountEdit(pledge.id);
                                  if (e.key === "Escape") cancelAmountEdit();
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() => saveAmountEdit(pledge.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={cancelAmountEdit}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="text-sm cursor-pointer hover:text-brand-orange hover:underline"
                              onClick={() => startAmountEdit(pledge)}
                              title="Click to edit"
                            >
                              {formatCurrency(pledge.amount)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingScheduleId === pledge.id ? (
                            <Select
                              value={editSchedule}
                              onValueChange={(v) => saveScheduleEdit(pledge.id, v as string)}
                            >
                              <SelectTrigger className="w-36 h-8 text-xs">
                                <SelectValue>
                                  {(value: string | null) =>
                                    value
                                      ? (SCHEDULE_OPTIONS.find((s) => s.value === value)?.label ?? value)
                                      : "Select"
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs cursor-pointer hover:border-brand-orange"
                              onClick={() => startScheduleEdit(pledge)}
                            >
                              <Settings2 className="h-3 w-3 mr-1" />
                              {SCHEDULE_OPTIONS.find((s) => s.value === pledge.schedule)?.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={pledge.autoCredit}
                              onCheckedChange={() => handleToggleAutoCredit(pledge.id)}
                            />
                            <span className={`text-xs font-medium ${pledge.autoCredit ? "text-green-600" : "text-muted-foreground"}`}>
                              {pledge.autoCredit ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-brand-orange hover:text-brand-orange"
                            onClick={() =>
                              manualEntryId === pledge.id
                                ? setManualEntryId(null)
                                : startManualEntry(pledge.id)
                            }
                          >
                            <PlusCircle className="h-3.5 w-3.5 mr-1" />
                            Entry
                          </Button>
                        </TableCell>
                      </TableRow>
                      {manualEntryId === pledge.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <div className="border-t border-b border-brand-orange/20 bg-brand-orange/5 px-6 py-4 space-y-3">
                              <p className="text-sm font-medium">
                                Manual Pledge Entry — {pledge.borrower}
                              </p>
                              <div className="flex items-end gap-4">
                                <div className="space-y-1.5">
                                  <p className="text-xs text-muted-foreground">Amount (PHP)</p>
                                  <Input
                                    type="number"
                                    min={1}
                                    step="1"
                                    placeholder="0"
                                    autoFocus
                                    className="w-40 h-9"
                                    value={manualAmount}
                                    onChange={(e) => setManualAmount(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleManualEntry(pledge.id);
                                      if (e.key === "Escape") setManualEntryId(null);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-xs text-muted-foreground">Transaction</p>
                                  <div className="flex rounded-md border overflow-hidden">
                                    <button
                                      type="button"
                                      className={`px-4 py-2 text-xs font-medium transition-colors ${
                                        manualTransaction === "credit"
                                          ? "bg-green-600 text-white"
                                          : "bg-background text-muted-foreground hover:bg-muted"
                                      }`}
                                      onClick={() => setManualTransaction("credit")}
                                    >
                                      Credit
                                    </button>
                                    <button
                                      type="button"
                                      className={`px-4 py-2 text-xs font-medium border-l transition-colors ${
                                        manualTransaction === "debit"
                                          ? "bg-red-600 text-white"
                                          : "bg-background text-muted-foreground hover:bg-muted"
                                      }`}
                                      onClick={() => setManualTransaction("debit")}
                                    >
                                      Debit
                                    </button>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-9 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                                    disabled={!manualAmount}
                                    onClick={() => handleManualEntry(pledge.id)}
                                  >
                                    Submit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9"
                                    onClick={() => setManualEntryId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No pledges found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue>{() => String(pageSize)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {processed.length === 0
                    ? "0 of 0"
                    : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, processed.length)} of ${processed.length}`}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Bulk Entry Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Manual Pledge Entry</DialogTitle>
              <DialogDescription>
                Set amount and transaction type for each selected member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto py-2">
              {pledges
                .filter((p) => selectedIds.has(p.id))
                .map((p) => {
                  const entry = bulkEntries[p.id] || { amount: "", transaction: "credit" };
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-40 truncate shrink-0" title={p.borrower}>
                        {p.borrower}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        placeholder="Amount"
                        className="w-28 h-8 text-sm"
                        value={entry.amount}
                        onChange={(e) => updateBulkEntry(p.id, "amount", e.target.value)}
                      />
                      <div className="flex rounded-md border overflow-hidden shrink-0">
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            entry.transaction === "credit"
                              ? "bg-green-600 text-white"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                          onClick={() => updateBulkEntry(p.id, "transaction", "credit")}
                        >
                          Credit
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-medium border-l transition-colors ${
                            entry.transaction === "debit"
                              ? "bg-red-600 text-white"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                          onClick={() => updateBulkEntry(p.id, "transaction", "debit")}
                        >
                          Debit
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                onClick={() => { handleBulkSubmit(); setBulkDialogOpen(false); }}
              >
                Submit All
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
