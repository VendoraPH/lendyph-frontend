"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
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
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import { shareCapitalService } from "@/services";
import { formatCurrency, formatDate } from "@/lib/format";
import { ledgerAmounts } from "@/utils/share-capital";
import type {
  ShareCapitalBookTotals,
  ShareCapitalLedgerEntry,
  ShareCapitalMember,
  ShareCapitalMemberPeriod,
} from "@/types";
import { toast } from "sonner";

// ── Types ──

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  /** The server's balance after this entry (GET /share-capital/ledger). */
  runningBalance: number | null;
}

/** Transform an API row into the shape the UI expects */
function toLedgerEntry(raw: ShareCapitalLedgerEntry): LedgerEntry {
  return {
    id: raw.id,
    date: raw.date,
    description: raw.description,
    reference: raw.reference,
    ...ledgerAmounts(raw),
    runningBalance: raw.running_balance ?? null,
  };
}

// ── Date range presets ──

const DATE_PRESETS = [
  { label: "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last Month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Last 3 Months", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
  { label: "Year to Date", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

const PAGE_SIZES = [10, 25, 50];

const SEARCH_DEBOUNCE_MS = 300;

// ── Sort ──

type MasterSortField = "name" | "balance";
type DetailSortField = "date";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />;
  return dir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-brand-orange" />
    : <ArrowDown className="h-3.5 w-3.5 ml-1 text-brand-orange" />;
}

/** "—" while a server figure has not arrived, never a browser stand-in. */
function money(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? "—" : formatCurrency(amount);
}

// ══════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════

/**
 * Every figure on this screen is the server's: each member's credits, debits
 * and balance and the book's totals come from GET /share-capital/members, and
 * the detail view's running balances and period figures from
 * GET /share-capital/ledger?borrower_id=. Nothing is added up here.
 */
function SubsidiaryLedgerContent() {
  // ── Master list state ──
  // The last answer and the request it belongs to: the list is loading while
  // the current request has no answer yet.
  const [membersPage, setMembersPage] = useState<{
    key: string;
    members: ShareCapitalMember[];
    total: number;
    totals: ShareCapitalBookTotals | null;
    matchingTotals: ShareCapitalBookTotals | null;
    // Distinct from "the ledger is empty". The toast is transient, so without
    // this the screen settles into an empty subsidiary ledger that reads as
    // "this co-op holds no share capital".
    failed: boolean;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [masterSort, setMasterSort] = useState<MasterSortField>("name");
  const [masterSortDir, setMasterSortDir] = useState<SortDir>("asc");
  const [masterPage, setMasterPage] = useState(1);
  const [masterPageSize, setMasterPageSize] = useState(25);

  // ── Detail state ──
  const [selectedMember, setSelectedMember] = useState<ShareCapitalMember | null>(null);
  const [detail, setDetail] = useState<{
    key: string;
    entries: LedgerEntry[];
    period: ShareCapitalMemberPeriod | null;
    // Set only when the drain gave up with pages outstanding: some entries are
    // missing from the table, though every figure shown is still the server's.
    shortfall: { shown: number; total: number | null } | null;
  } | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [detailSort, setDetailSort] = useState<DetailSortField>("date");
  const [detailSortDir, setDetailSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch the member list ──
  const membersKey = JSON.stringify([masterPage, masterPageSize, masterSort, masterSortDir, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    shareCapitalService
      .members({
        page: masterPage,
        per_page: masterPageSize,
        sort: masterSort,
        direction: masterSortDir,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      })
      .then((res) => {
        if (cancelled) return;
        setMembersPage({
          key: membersKey,
          members: res?.data ?? [],
          total: res?.meta?.total ?? 0,
          totals: res?.meta?.totals ?? null,
          matchingTotals: res?.meta?.matching_totals ?? null,
          failed: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setMembersPage({ key: membersKey, members: [], total: 0, totals: null, matchingTotals: null, failed: true });
        toast.error("We couldn't load the ledger data. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [membersKey, masterPage, masterPageSize, masterSort, masterSortDir, debouncedSearch]);

  const loading = membersPage?.key !== membersKey;
  const failed = membersPage?.failed ?? false;
  const members = membersPage?.members ?? [];
  const memberTotal = membersPage?.total ?? 0;
  const bookTotals = membersPage?.totals ?? null;
  const matchingTotals = membersPage?.matchingTotals ?? null;

  // ── Fetch one member's entries ──
  const selectedMemberId = selectedMember?.borrower_id ?? null;
  const rangeFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const rangeTo = dateRange?.from ? format(dateRange.to ?? dateRange.from, "yyyy-MM-dd") : undefined;
  const detailKey = JSON.stringify([selectedMemberId, rangeFrom, rangeTo]);

  useEffect(() => {
    if (selectedMemberId === null) return;
    let cancelled = false;
    shareCapitalService
      .memberLedger(selectedMemberId, {
        ...(rangeFrom ? { date_from: rangeFrom } : {}),
        ...(rangeTo ? { date_to: rangeTo } : {}),
      })
      .then(({ rows, truncated, total, summary }) => {
        if (cancelled) return;
        setDetail({
          key: detailKey,
          entries: rows.map(toLedgerEntry),
          period: summary,
          shortfall: truncated ? { shown: rows.length, total } : null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDetail({ key: detailKey, entries: [], period: null, shortfall: null });
        toast.error("We couldn't load this member's entries. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [detailKey, selectedMemberId, rangeFrom, rangeTo]);

  const currentDetail = detail?.key === detailKey ? detail : null;
  const detailLoading = selectedMemberId !== null && currentDetail === null;
  const entries = useMemo(() => currentDetail?.entries ?? [], [currentDetail]);
  const period = currentDetail?.period ?? null;
  const shortfall = currentDetail?.shortfall ?? null;

  // ── Computed ──

  const masterTotalPages = Math.max(1, Math.ceil(memberTotal / masterPageSize));
  const masterSafePage = Math.min(masterPage, masterTotalPages);

  // The API lists entries newest first (date, then id, descending); oldest
  // first is the same list reversed. Order only: the balances are the server's.
  const displayedEntries = useMemo(
    () => (detailSortDir === "desc" ? entries : [...entries].reverse()),
    [entries, detailSortDir],
  );

  const openingBalance = period?.opening_balance ?? null;
  const detailTotalCredits = period?.total_credits ?? null;
  const detailTotalDebits = period?.total_debits ?? null;
  const endingBalance = period?.ending_balance ?? null;

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

  function openMember(member: ShareCapitalMember) {
    setSelectedMember(member);
    setDateRange(undefined);
    setDetailSort("date");
    setDetailSortDir("asc");
  }

  function closeMember() {
    setSelectedMember(null);
  }

  const selectedName = selectedMember ? (selectedMember.full_name ?? `Borrower #${selectedMember.borrower_id}`) : null;

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {failed && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              The subsidiary ledger could not be loaded
            </p>
            <p className="mt-0.5 text-muted-foreground">
              No member balances are shown below. That is a failure to read the
              ledger, not a co-op with no share capital — do not reconcile
              against this screen until it loads.
            </p>
          </div>
        </div>
      )}

      {selectedMember && shortfall && (
        <IncompleteListNotice
          shown={shortfall.shown}
          total={shortfall.total}
          noun="ledger entries"
          consequence="Some of this member's entries are missing from the table below. The balances and totals shown are the server's and still cover every entry."
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        {selectedMember && (
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMember}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedName ?? "Subsidiary Ledger"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedMember ? (
              <>
                <button
                  type="button"
                  className="hover:underline hover:text-foreground"
                  onClick={closeMember}
                >
                  Subsidiary Ledger
                </button>
                {" / "}
                <span>{selectedName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({selectedMember.borrower_code ?? selectedMember.borrower_id})
                </span>
              </>
            ) : (
              "Share capital balances per member"
            )}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          LOADING STATE
          ════════════════════════════════════════════ */}
      {(selectedMember ? detailLoading : loading) ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-7 w-16 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="sm:col-span-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-8 w-64 bg-muted animate-pulse rounded" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                    <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) :

      /* ════════════════════════════════════════════
          MASTER LIST VIEW
          ════════════════════════════════════════════ */
      !selectedMember ? (
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
                  <span className="text-2xl font-bold">{bookTotals ? bookTotals.member_count : "—"}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Credits</span>
                  <span className="text-2xl font-bold text-green-600">{money(bookTotals?.total_credits)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Debits</span>
                  <span className="text-2xl font-bold text-red-600">{money(bookTotals?.total_debits)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Share Capital</span>
                  <span className="text-2xl font-bold text-brand-orange">{money(bookTotals?.balance)}</span>
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
                  <span className="text-muted-foreground font-normal ml-1">({memberTotal})</span>
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
                      <TableHead className="text-xs">Last Transaction Date</TableHead>
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
                    {members.map((member) => (
                      <TableRow
                        key={member.borrower_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openMember(member)}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {member.borrower_code ?? member.borrower_id}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {member.full_name ?? `Borrower #${member.borrower_id}`}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.last_transaction_date
                            ? formatDate(member.last_transaction_date)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {formatCurrency(member.balance)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No members found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {/* Totals footer */}
                  {members.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3} className="text-sm">
                          Total ({memberTotal} member{memberTotal !== 1 ? "s" : ""})
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {money(matchingTotals?.balance)}
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
                    {memberTotal === 0
                      ? "0 of 0"
                      : `${(masterSafePage - 1) * masterPageSize + 1}–${Math.min(masterSafePage * masterPageSize, memberTotal)} of ${memberTotal}`}
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
      ) : selectedMember ? (
        /* ════════════════════════════════════════════
           MEMBER DETAIL VIEW
           ════════════════════════════════════════════ */
        <>
          {/* Member Summary Cards */}
          {period && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground mb-1">Opening Balance</p>
                  <p className="text-2xl font-bold tabular-nums">{money(openingBalance)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
                  <p className="text-2xl font-bold text-green-600 tabular-nums">{money(detailTotalCredits)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
                  <p className="text-2xl font-bold text-red-600 tabular-nums">
                    {detailTotalDebits ? formatCurrency(detailTotalDebits) : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-brand-orange/30">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground mb-1">Ending Balance</p>
                  <p className="text-2xl font-bold text-brand-orange tabular-nums">{money(endingBalance)}</p>
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
                  <span className="text-muted-foreground font-normal ml-1">({displayedEntries.length})</span>
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
                    {(dateRange?.from || (openingBalance !== null && openingBalance !== 0)) && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={3} className="text-sm font-medium italic text-muted-foreground">
                          {dateRange?.from
                            ? `Opening Balance as of ${format(dateRange.from, "MMM d, yyyy")}`
                            : "Opening Balance"}
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {money(openingBalance)}
                        </TableCell>
                      </TableRow>
                    )}
                    {displayedEntries.map((entry) => (
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
                          {money(entry.runningBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {displayedEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          <p>No entries found{dateRange?.from ? " for this period" : ""}.</p>
                          <p className="text-xs mt-1">Create entries via Pledge Entry → Entry button</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {/* Totals Footer */}
                  {displayedEntries.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3} className="text-sm">
                          Period Total
                        </TableCell>
                        <TableCell className="text-right text-sm text-red-600 tabular-nums">
                          {detailTotalDebits ? formatCurrency(detailTotalDebits) : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm text-green-600 tabular-nums">
                          {money(detailTotalCredits)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {money(endingBalance)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default function SubsidiaryLedgerPage() {
  return (
    <RouteGuard permission="share_capital:view" pageName="Subsidiary Ledger">
      <SubsidiaryLedgerContent />
    </RouteGuard>
  );
}
