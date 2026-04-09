"use client";

import React, { useState, useMemo } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  Search,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, isWithinInterval, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";

// ── Formatting ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Types ──

interface LedgerEntry {
  id: number;
  memberId: string;
  member: string;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
}

// ── Mock Data ──

const MOCK_LEDGER: LedgerEntry[] = [
  // Rosario D. Santos
  { id: 1, memberId: "MBR-001", member: "Rosario D. Santos", date: "2026-01-15", description: "Initial share capital contribution", reference: "OR-2026-0001", debit: 0, credit: 2000 },
  { id: 2, memberId: "MBR-001", member: "Rosario D. Santos", date: "2026-02-01", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0010", debit: 0, credit: 500 },
  { id: 3, memberId: "MBR-001", member: "Rosario D. Santos", date: "2026-02-15", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0020", debit: 0, credit: 500 },
  { id: 4, memberId: "MBR-001", member: "Rosario D. Santos", date: "2026-03-01", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0030", debit: 0, credit: 500 },
  { id: 5, memberId: "MBR-001", member: "Rosario D. Santos", date: "2026-03-15", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0042", debit: 0, credit: 500 },
  { id: 6, memberId: "MBR-001", member: "Rosario D. Santos", date: "2026-04-01", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0055", debit: 0, credit: 500 },
  // Roberto Garcia
  { id: 7, memberId: "MBR-002", member: "Roberto Garcia", date: "2026-01-15", description: "Initial share capital contribution", reference: "OR-2026-0002", debit: 0, credit: 5000 },
  { id: 8, memberId: "MBR-002", member: "Roberto Garcia", date: "2026-02-15", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0021", debit: 0, credit: 1000 },
  { id: 9, memberId: "MBR-002", member: "Roberto Garcia", date: "2026-03-15", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0043", debit: 0, credit: 1000 },
  { id: 10, memberId: "MBR-002", member: "Roberto Garcia", date: "2026-04-01", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0056", debit: 0, credit: 1000 },
  // Eduardo Mendoza
  { id: 11, memberId: "MBR-003", member: "Eduardo Mendoza", date: "2026-01-30", description: "Initial share capital contribution", reference: "OR-2026-0003", debit: 0, credit: 1500 },
  { id: 12, memberId: "MBR-003", member: "Eduardo Mendoza", date: "2026-02-28", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0015", debit: 0, credit: 500 },
  { id: 13, memberId: "MBR-003", member: "Eduardo Mendoza", date: "2026-03-15", description: "Withdrawal - partial", reference: "WDR-2026-0005", debit: 200, credit: 0 },
  { id: 14, memberId: "MBR-003", member: "Eduardo Mendoza", date: "2026-03-30", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0038", debit: 0, credit: 500 },
  // Maria L. Reyes
  { id: 15, memberId: "MBR-004", member: "Maria L. Reyes", date: "2026-02-01", description: "Initial share capital contribution", reference: "OR-2026-0008", debit: 0, credit: 3000 },
  { id: 16, memberId: "MBR-004", member: "Maria L. Reyes", date: "2026-03-01", description: "Monthly pledge - manual", reference: "PLG-2026-0025", debit: 0, credit: 500 },
  { id: 17, memberId: "MBR-004", member: "Maria L. Reyes", date: "2026-03-30", description: "Monthly pledge - manual", reference: "PLG-2026-0039", debit: 0, credit: 500 },
  // Ana Santos
  { id: 18, memberId: "MBR-005", member: "Ana Santos", date: "2026-01-15", description: "Initial share capital contribution", reference: "OR-2026-0004", debit: 0, credit: 3000 },
  { id: 19, memberId: "MBR-005", member: "Ana Santos", date: "2026-02-15", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0022", debit: 0, credit: 1000 },
  { id: 20, memberId: "MBR-005", member: "Ana Santos", date: "2026-03-15", description: "Monthly pledge - auto-credit", reference: "PLG-2026-0044", debit: 0, credit: 1000 },
  // Carmen Torres
  { id: 21, memberId: "MBR-006", member: "Carmen Torres", date: "2026-02-15", description: "Initial share capital contribution", reference: "OR-2026-0009", debit: 0, credit: 1000 },
  { id: 22, memberId: "MBR-006", member: "Carmen Torres", date: "2026-03-15", description: "Monthly pledge - manual", reference: "PLG-2026-0045", debit: 0, credit: 500 },
];

// ── Date range presets ──

const DATE_PRESETS = [
  { label: "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last Month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Last 3 Months", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
  { label: "Year to Date", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

const PAGE_SIZES = [10, 25, 50];

// ── Helpers ──

function computeMemberSummaries(entries: LedgerEntry[]) {
  const map = new Map<string, {
    memberId: string;
    name: string;
    totalDebits: number;
    totalCredits: number;
    entryCount: number;
  }>();

  for (const e of entries) {
    const existing = map.get(e.member) ?? {
      memberId: e.memberId,
      name: e.member,
      totalDebits: 0,
      totalCredits: 0,
      entryCount: 0,
    };
    existing.totalDebits += e.debit;
    existing.totalCredits += e.credit;
    existing.entryCount++;
    map.set(e.member, existing);
  }

  return Array.from(map.values()).map((m) => ({
    ...m,
    balance: m.totalCredits - m.totalDebits,
  }));
}

function computeRunningBalance(entries: LedgerEntry[], openingBalance: number) {
  let balance = openingBalance;
  return entries.map((e) => {
    balance = balance + e.credit - e.debit;
    return { ...e, runningBalance: balance };
  });
}

// ── Sort ──

type MasterSortField = "name" | "balance";
type DetailSortField = "date" | "description" | "debit" | "credit" | "runningBalance";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />;
  return dir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-brand-orange" />
    : <ArrowDown className="h-3.5 w-3.5 ml-1 text-brand-orange" />;
}

// ══════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════

export default function SubsidiaryLedgerPage() {
  // ── View state ──
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // ── Master list state ──
  const [search, setSearch] = useState("");
  const [masterSort, setMasterSort] = useState<MasterSortField | null>(null);
  const [masterSortDir, setMasterSortDir] = useState<SortDir>("asc");
  const [masterPage, setMasterPage] = useState(1);
  const [masterPageSize, setMasterPageSize] = useState(25);

  // ── Detail state ──
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [detailSort, setDetailSort] = useState<DetailSortField>("date");
  const [detailSortDir, setDetailSortDir] = useState<SortDir>("asc");

  // ── Computed: Master ──

  const allMembers = useMemo(() => computeMemberSummaries(MOCK_LEDGER), []);

  const filteredMembers = useMemo(() => {
    let result = [...allMembers];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q)
      );
    }
    if (masterSort) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (masterSort) {
          case "name": cmp = a.name.localeCompare(b.name); break;
          case "balance": cmp = a.balance - b.balance; break;
        }
        return masterSortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [allMembers, search, masterSort, masterSortDir]);

  const masterTotalPages = Math.max(1, Math.ceil(filteredMembers.length / masterPageSize));
  const masterSafePage = Math.min(masterPage, masterTotalPages);
  const paginatedMembers = filteredMembers.slice(
    (masterSafePage - 1) * masterPageSize,
    masterSafePage * masterPageSize
  );

  const grandTotalCredits = allMembers.reduce((s, m) => s + m.totalCredits, 0);
  const grandTotalDebits = allMembers.reduce((s, m) => s + m.totalDebits, 0);
  const grandTotalBalance = allMembers.reduce((s, m) => s + m.balance, 0);

  // ── Computed: Detail ──

  const memberAllEntries = useMemo(() => {
    if (!selectedMember) return [];
    return MOCK_LEDGER
      .filter((e) => e.member === selectedMember)
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [selectedMember]);

  // Entries before the date range (for opening balance)
  const { openingBalance, filteredEntries } = useMemo(() => {
    if (!dateRange?.from) {
      return { openingBalance: 0, filteredEntries: memberAllEntries };
    }

    let opening = 0;
    const filtered: LedgerEntry[] = [];

    for (const e of memberAllEntries) {
      const d = parseISO(e.date);
      const rangeEnd = dateRange.to ?? dateRange.from;
      if (d < dateRange.from) {
        opening += e.credit - e.debit;
      } else if (isWithinInterval(d, { start: dateRange.from, end: rangeEnd })) {
        filtered.push(e);
      }
    }

    return { openingBalance: opening, filteredEntries: filtered };
  }, [memberAllEntries, dateRange]);

  const entriesWithBalance = useMemo(() => {
    const sorted = [...filteredEntries];
    // Always compute running balance in chronological order first
    const withBalance = computeRunningBalance(
      sorted.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()),
      openingBalance
    );

    // Then apply display sort
    if (detailSort === "date") {
      withBalance.sort((a, b) => {
        const cmp = parseISO(a.date).getTime() - parseISO(b.date).getTime();
        return detailSortDir === "asc" ? cmp : -cmp;
      });
    }

    return withBalance;
  }, [filteredEntries, openingBalance, detailSort, detailSortDir]);

  const detailTotalDebits = filteredEntries.reduce((s, e) => s + e.debit, 0);
  const detailTotalCredits = filteredEntries.reduce((s, e) => s + e.credit, 0);
  const endingBalance = openingBalance + detailTotalCredits - detailTotalDebits;

  const selectedSummary = selectedMember ? allMembers.find((m) => m.name === selectedMember) : null;

  // ── Handlers ──

  function toggleMasterSort(field: MasterSortField) {
    if (masterSort === field) {
      setMasterSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setMasterSort(field);
      setMasterSortDir("asc");
    }
    setMasterPage(1);
  }

  function toggleDetailSort(field: DetailSortField) {
    if (detailSort === field) {
      setDetailSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDetailSort(field);
      setDetailSortDir("asc");
    }
  }

  function openMember(name: string) {
    setSelectedMember(name);
    setDateRange(undefined);
    setDetailSort("date");
    setDetailSortDir("asc");
  }

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════

  return (
    <RouteGuard permission="share_capital:view" pageName="Subsidiary Ledger">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          {selectedMember && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMember(null)}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedMember ?? "Subsidiary Ledger"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedMember ? (
                <>
                  <button
                    type="button"
                    className="hover:underline hover:text-foreground"
                    onClick={() => setSelectedMember(null)}
                  >
                    Subsidiary Ledger
                  </button>
                  {" / "}
                  <span>{selectedMember}</span>
                  {selectedSummary && (
                    <span className="ml-2 text-xs text-muted-foreground">({selectedSummary.memberId})</span>
                  )}
                </>
              ) : (
                "Share capital balances per member"
              )}
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            MASTER LIST VIEW
            ════════════════════════════════════════════ */}
        {!selectedMember ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Landmark className="h-4 w-4" />
                      <span className="text-sm font-medium">Total Members</span>
                    </div>
                    <span className="text-2xl font-bold">{allMembers.length}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Total Credits</span>
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalCredits)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Total Debits</span>
                    <span className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalDebits)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Total Share Capital</span>
                    <span className="text-2xl font-bold text-brand-orange">{formatCurrency(grandTotalBalance)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Members Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-medium">
                    Members
                    <span className="text-muted-foreground font-normal ml-1">({filteredMembers.length})</span>
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setMasterPage(1); }}
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 text-xs">ID</TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleMasterSort("name")}
                        >
                          <span className="flex items-center text-xs">
                            Member Name
                            <SortIcon active={masterSort === "name"} dir={masterSortDir} />
                          </span>
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleMasterSort("balance")}
                        >
                          <span className="flex items-center justify-end text-xs">
                            Balance
                            <SortIcon active={masterSort === "balance"} dir={masterSortDir} />
                          </span>
                        </TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMembers.map((member) => (
                        <TableRow
                          key={member.name}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openMember(member.name)}
                        >
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {member.memberId}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{member.name}</TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(member.balance)}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedMembers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No members found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {/* Totals footer */}
                    {paginatedMembers.length > 0 && (
                      <TableFooter>
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={2} className="text-sm">
                            Total ({filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""})
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatCurrency(filteredMembers.reduce((s, m) => s + m.balance, 0))}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rows per page</span>
                    <Select
                      value={String(masterPageSize)}
                      onValueChange={(v) => { setMasterPageSize(Number(v)); setMasterPage(1); }}
                    >
                      <SelectTrigger className="w-16 h-8 text-xs">
                        <SelectValue>{() => String(masterPageSize)}</SelectValue>
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
                      {filteredMembers.length === 0
                        ? "0 of 0"
                        : `${(masterSafePage - 1) * masterPageSize + 1}–${Math.min(masterSafePage * masterPageSize, filteredMembers.length)} of ${filteredMembers.length}`}
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={masterSafePage <= 1} onClick={() => setMasterPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={masterSafePage >= masterTotalPages} onClick={() => setMasterPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* ════════════════════════════════════════════
             MEMBER DETAIL VIEW
             ════════════════════════════════════════════ */
          <>
            {/* Member Summary Cards */}
            {selectedSummary && (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Opening Balance</p>
                    <p className="text-2xl font-bold tabular-nums">{formatCurrency(openingBalance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
                    <p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(detailTotalCredits)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
                    <p className="text-2xl font-bold text-red-600 tabular-nums">
                      {detailTotalDebits > 0 ? formatCurrency(detailTotalDebits) : "—"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-brand-orange/30">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Ending Balance</p>
                    <p className="text-2xl font-bold text-brand-orange tabular-nums">{formatCurrency(endingBalance)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Ledger Entries Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-medium">
                    Ledger Entries
                    <span className="text-muted-foreground font-normal ml-1">({entriesWithBalance.length})</span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date Range Picker */}
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" />
                        }
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM d, yyyy")} – {format(dateRange.to, "MMM d, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM d, yyyy")
                          )
                        ) : (
                          "All dates"
                        )}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <div className="flex">
                          <div className="border-r p-3 space-y-1">
                            <button
                              type="button"
                              className="block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted"
                              onClick={() => setDateRange(undefined)}
                            >
                              All dates
                            </button>
                            {DATE_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                className="block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted"
                                onClick={() => setDateRange(preset.getValue())}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    {/* Export placeholder */}
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleDetailSort("date")}
                        >
                          <span className="flex items-center text-xs">
                            Date
                            <SortIcon active={detailSort === "date"} dir={detailSortDir} />
                          </span>
                        </TableHead>
                        <TableHead className="text-xs">Reference</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-right text-xs">Debit</TableHead>
                        <TableHead className="text-right text-xs">Credit</TableHead>
                        <TableHead className="text-right text-xs">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Opening Balance Row */}
                      {(dateRange?.from || openingBalance !== 0) && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={3} className="text-sm font-medium italic text-muted-foreground">
                            {dateRange?.from
                              ? `Opening Balance as of ${format(dateRange.from, "MMM d, yyyy")}`
                              : "Opening Balance"}
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(openingBalance)}
                          </TableCell>
                        </TableRow>
                      )}
                      {entriesWithBalance.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(entry.date)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                            {entry.reference}
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.description}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-red-600">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-green-600">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(entry.runningBalance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {entriesWithBalance.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No entries found for this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {/* Totals Footer */}
                    {entriesWithBalance.length > 0 && (
                      <TableFooter>
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={3} className="text-sm">
                            Period Total
                          </TableCell>
                          <TableCell className="text-right text-sm text-red-600 tabular-nums">
                            {detailTotalDebits > 0 ? formatCurrency(detailTotalDebits) : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm text-green-600 tabular-nums">
                            {formatCurrency(detailTotalCredits)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatCurrency(endingBalance)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
