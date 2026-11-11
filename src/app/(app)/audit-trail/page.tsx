"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RouteGuard, TablePagination } from "@/components/common";
// Imported directly rather than through the `common` barrel on purpose: that
// barrel is not tree-shaken and is pulled in by nearly every page, so
// re-exporting a calendar there would ship react-day-picker to all of them.
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { getInitials } from "@/lib/initials";
import { auditService } from "@/services";
import { usePermission } from "@/hooks";
import { auditLoadRestriction, auditTrailRestriction } from "./_lib/audit-access";
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
  Cog,
  UserRound,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PER_PAGE } from "@/lib/paginate";
import { formatDate, formatDateISO, formatTime, todayISO } from "@/lib/format";
import type { AuditLog, AuditAction } from "@/types";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_MODULE_OPTIONS,
  auditActionLabel,
  auditChangePair,
  auditDescription,
  auditFieldLabel,
  auditModuleLabel,
  auditTargetLabel,
  auditTargetTypeLine,
  auditUserName,
  auditUserRole,
} from "./_lib/audit-labels";

// ── Constants ──

const ACTION_COLOR: Record<AuditAction, string> = {
  login: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  logout: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  created: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  updated: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  deleted: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  voided: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  approved: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  released: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  printed: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  reset_password: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  status_changed: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  uploaded: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  attachment_removed: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  loan_chain_cancelled: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  savings_account_frozen: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  savings_account_unfrozen: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  savings_account_reactivated: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  savings_account_dormant: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  savings_account_closed: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  savings_hold_expired: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  savings_approval_expired: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  time_deposit_matured: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  time_deposit_settled: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  time_deposit_preterminated: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  cda_workflow: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  cda_report_saved: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  cda_report_refreshed: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  cda_export_generated: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  year_end_captured: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
};

// Each filter's options, "all" first. The same list is the Select's `items`,
// which is what lets the closed trigger show the label, not the raw value.
const MODULE_FILTER_ITEMS = [{ value: "all", label: "All Modules" }, ...AUDIT_MODULE_OPTIONS];
const ACTION_FILTER_ITEMS = [{ value: "all", label: "All Actions" }, ...AUDIT_ACTION_OPTIONS];



// ── Helpers ──

/** A user's initials, or a system mark for a row no user made. */
function AuditAvatarContent({ log, iconClassName }: { log: AuditLog; iconClassName: string }) {
  if (log.actor_type === "member") return <UserRound className={iconClassName} aria-hidden="true" />;
  if (!log.user?.full_name?.trim()) return <Cog className={iconClassName} aria-hidden="true" />;
  return <>{getInitials(log.user.full_name)}</>;
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
  const actionColor = ACTION_COLOR[log.action] ?? "";

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
              <AuditAvatarContent log={log} iconClassName="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">{auditUserName(log)}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {auditUserRole(log)}
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
                <Badge variant="outline" className={actionColor}>
                  {auditActionLabel(log.action)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Module</p>
                <p className="text-sm font-medium">
                  {auditModuleLabel(log)}
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
              {auditDescription(log)}
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
                  <p className="text-sm font-medium">{auditTargetLabel(log.target)}</p>
                  {auditTargetTypeLine(log.target) !== null && (
                    <p className="text-xs text-muted-foreground">
                      {auditTargetTypeLine(log.target)}
                    </p>
                  )}
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
                        {auditFieldLabel(change.field, log.target)}
                      </p>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {change.old !== null && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="inline-flex h-5 shrink-0 items-center justify-center rounded bg-red-100 px-1.5 text-red-600 text-xs font-medium">
                            Old
                          </span>
                          <span className="text-red-700 break-all">
                            {auditChangePair(log, change).old}
                          </span>
                        </div>
                      )}
                      {change.new !== null && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="inline-flex h-5 shrink-0 items-center justify-center rounded bg-green-100 px-1.5 text-green-600 text-xs font-medium">
                            New
                          </span>
                          <span className="text-green-700 break-all">
                            {auditChangePair(log, change).new}
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

/**
 * Page sizes offered here, and the reason they start at 25 rather than the
 * shared default of 10: this is a chronological event feed that people scan, and
 * the top option is `MAX_PER_PAGE` because the server refuses to serve more
 * (`min(per_page, 100)`) — offering 200 would silently hand back 100.
 */
const PER_PAGE_OPTIONS = [25, 50, MAX_PER_PAGE] as const;
const DEFAULT_PER_PAGE = 25;

function AuditTrailContent() {
  // `searchDraft` is what the box shows; `search` is what has been sent. Keeping
  // them apart is what makes the debounce one request per settled query instead
  // of one per keystroke.
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  // `YYYY-MM-DD` or null, never `Date`. This is exactly what `date_from` and
  // `date_to` want, and it is what `fetchLogs`' dependency array can compare —
  // a Date rebuilt on each render is a new object every time, which would
  // re-trigger the fetch forever.
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(DEFAULT_PER_PAGE);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null);
  // Set when the list answers 403: the table says why instead of "No audit logs found".
  const [loadRestriction, setLoadRestriction] = useState<string | null>(null);

  // Guards against out-of-order responses: rapid page clicks or a fast-changing
  // filter can land an older request last and repaint the previous page's rows
  // underneath the newer page number.
  const requestIdRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    // A clamp re-requests immediately, so `loading` has to stay true across the
    // hand-off or the table paints one frame of the old rows under new totals.
    let clamping = false;
    try {
      setLoading(true);
      const params: Record<string, unknown> = { page, per_page: perPage };
      if (actionFilter !== "all") params.action = actionFilter;
      if (moduleFilter !== "all") params.module = moduleFilter;
      // Whole-day bounds on `created_at`, applied by `buildQuery()`. Sent as
      // the calendar strings themselves — shifting either end by a day here to
      // reinterpret the window would put the screen and the CSV, which sends
      // the same two values, one day apart.
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      // Sent to the server, not applied here. Filtering the fetched page
      // client-side would search one page of an unbounded log and report
      // "no results" for events that exist — the same truncation as the table,
      // one layer along. `buildQuery()` searches action, auditable_type,
      // description and the user's name; the export already relied on it.
      if (search) params.search = search;
      const res = await auditService.list(params);
      if (requestId !== requestIdRef.current) return;
      const rows = res?.data ?? [];
      const nextMeta = res?.meta ?? null;

      // Applied before the clamp check: the paginator and the total card must
      // describe the response we just got, not the one we are about to replace.
      setMeta(nextMeta);

      // A filter change (or a deep link) can leave `page` past `last_page`,
      // which the server answers with zero rows. Step back to a page that has
      // some rather than dumping someone on an empty table. Bounded by
      // `page - 1` so it strictly decreases and cannot loop on a nonsense
      // `last_page`.
      if (rows.length === 0 && page > 1) {
        clamping = true;
        setPage(Math.max(1, Math.min(nextMeta?.last_page ?? 1, page - 1)));
        return;
      }

      setLogs(rows);
      setLoadRestriction(null);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        const restriction = auditLoadRestriction(err);
        if (!restriction) toast.error("We couldn't load the audit logs. Please try again.");
        setLoadRestriction(restriction);
        setLogs([]);
        setMeta(null);
      }
    } finally {
      if (requestId === requestIdRef.current && !clamping) setLoading(false);
    }
  }, [actionFilter, moduleFilter, dateFrom, dateTo, search, page, perPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Debounce the search box, and reset to page 1 with it ──
  useEffect(() => {
    if (searchDraft.trim() === search) return;
    const t = setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchDraft, search]);

  const todayStr = todayISO();

  // Every filter resets to page 1: page 4 of "all modules" is rarely page 4 of
  // "loans", and staying put lands on rows the user never asked for — or on an
  // empty page that looks like an empty log.
  // `string | null`: the Select clears to null when its value is deselected.
  const changeModuleFilter = (value: string | null) => {
    setModuleFilter(value ?? "all");
    setPage(1);
  };
  const changeActionFilter = (value: string | null) => {
    setActionFilter(value ?? "all");
    setPage(1);
  };
  const changeDateRange = (from: string | null, to: string | null) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };
  const changePerPage = (next: number) => {
    setPerPage(next);
    setPage(1);
  };

  const hasFilters =
    searchDraft !== "" ||
    moduleFilter !== "all" ||
    actionFilter !== "all" ||
    dateFrom !== null ||
    dateTo !== null;

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setModuleFilter("all");
    setActionFilter("all");
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
  };

  // `meta.total` is the number of rows MATCHING THE FILTER, across all pages —
  // which is what the paginator has to divide and what the card has to show.
  // Falling back to the page length keeps both honest if a response omits meta.
  const total = meta?.total ?? logs.length;

  const [exporting, setExporting] = useState(false);
  /**
   * Exports every row matching the CURRENT FILTERS — not the current page.
   *
   * `/audit-logs/export` is its own endpoint and is deliberately unpaginated
   * server-side, so `page`/`per_page` are correctly absent below: adding them
   * would narrow the file to what is on screen while the button still says
   * "Export". The filters are passed so the CSV matches what the user is
   * looking at, `search` and the date window included — both are the same
   * server-side parameters the table runs on, so the two cannot disagree.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, unknown> = {};
      if (search) params.search = search;
      if (actionFilter !== "all") params.action = actionFilter;
      if (moduleFilter !== "all") params.module = moduleFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const blob = await auditService.export(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${todayISO()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Audit logs exported");
    } catch {
      toast.error("We couldn't export the audit logs. Please try again.");
    } finally {
      setExporting(false);
    }
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
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting..." : "Export"}
        </Button>
      </div>

      {/*
        Summary Cards.

        Only the first of these can see the whole log: `meta.total` is counted
        server-side over every matching row. The other three are computed from
        `logs`, which is now ONE page — so they are labelled as one page. That
        labelling is the point of this change, not decoration: an unqualified
        "Active Users: 4" beside a paginated table is the same lie as a correct
        total beside a truncated one, and the server offers no per-filter
        equivalent to compute them from.
      */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold tabular-nums">
              {total.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {hasFilters ? "matching filters" : "all time"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-2xl font-bold tabular-nums">
              {
                // created_at is an instant, so a string prefix match compared
                // the server's rendering of it against a local calendar day —
                // wrong for every log written before 08:00 Manila if the API
                // serialises UTC. Parse it, then compare local calendar days.
                logs.filter(
                  (l) => formatDateISO(new Date(l.created_at)) === todayStr
                ).length
              }
            </p>
            <p className="text-[10px] text-muted-foreground">on this page</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Active Users</p>
            <p className="text-2xl font-bold tabular-nums">
              {new Set(logs.filter((l) => l.user).map((l) => l.user.id)).size}
            </p>
            <p className="text-[10px] text-muted-foreground">on this page</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">
              Critical Actions
            </p>
            <p className="text-2xl font-bold text-red-600 tabular-nums">
              {
                logs.filter((l) =>
                  ["deleted", "voided", "rejected"].includes(l.action)
                ).length
              }
            </p>
            <p className="text-[10px] text-muted-foreground">on this page</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">
            {/* The count of every matching row, not of the visible page — the
                paginator underneath says which slice of it is on screen. */}
            Activity Log ({total.toLocaleString()})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="pl-9 h-9"
                aria-label="Search audit logs"
              />
            </div>
            <Select value={moduleFilter} onValueChange={changeModuleFilter} items={MODULE_FILTER_ITEMS}>
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_FILTER_ITEMS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={changeActionFilter} items={ACTION_FILTER_ITEMS}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_FILTER_ITEMS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter
              label="Date Exclusive"
              from={dateFrom}
              to={dateTo}
              onChange={changeDateRange}
            />
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
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : (
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
                {logs.map((log) => {
                  const actionColor = ACTION_COLOR[log.action] ?? "";
                  return (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={async () => {
                        setSelectedLog(log);
                        try {
                          const fresh = await auditService.detail(log.id);
                          if (fresh) setSelectedLog(fresh);
                        } catch {
                          // Keep the list row data if detail fetch fails
                        }
                      }}
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
                            <AuditAvatarContent log={log} iconClassName="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {auditUserName(log)}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {auditUserRole(log)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(actionColor)}
                        >
                          {auditActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {auditModuleLabel(log)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {auditDescription(log)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {loadRestriction ??
                        (hasFilters
                          ? "No audit logs match these filters."
                          : "No audit logs found.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {/*
              An audit log only grows, so this paginates rather than draining:
              there is no page count at which "fetch everything" stops being a
              growing number of requests and a growing amount of memory for a
              screen that shows a screenful. `TablePagination` is controlled and
              does no slicing — `logs` is already the server's page.
            */}
            <TablePagination
              page={meta?.current_page ?? page}
              perPage={meta?.per_page ?? perPage}
              total={total}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onPerPageChange={changePerPage}
            />
          </div>
          )}
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

/** The Audit Trail in place of its logs, for a user the API would refuse them to. */
function AuditTrailRestricted({ message }: { message: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground">
          Track and review all user actions across the system
        </p>
      </div>
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <ShieldAlert className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">{message}</p>
            <p className="text-sm text-muted-foreground">
              Ask your administrator for the &quot;See all branches&quot; permission.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Checks branch access before the logs are requested. */
function AuditTrailAccess() {
  const restriction = auditTrailRestriction(usePermission().can("branches:view_all"));
  return restriction ? <AuditTrailRestricted message={restriction} /> : <AuditTrailContent />;
}

export default function AuditTrailPage() {
  return (
    <RouteGuard permission="audit_logs:view" pageName="Audit Trail">
      <AuditTrailAccess />
    </RouteGuard>
  );
}
