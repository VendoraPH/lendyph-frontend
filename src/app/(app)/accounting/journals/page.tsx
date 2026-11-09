"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { PermissionGate, RouteGuard, TablePagination } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/use-search-page";
import { accountingService } from "@/services";
import { getErrorMessage } from "@/lib/api-error";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, todayISO } from "@/lib/format";
import type { JournalPage } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";
import { JournalReferenceCell } from "../_components/journal-source-document";
import { journalSourceLabel } from "../_lib/display-labels";
import {
  ANY_SOURCE,
  ANY_STATUS,
  journalSourceItems,
  journalStatusItems,
} from "../_lib/select-items";
import { JournalStatusBadge } from "./_components/journal-status-badge";
import {
  JOURNAL_PAGE_SIZE,
  journalRegisterKey,
  journalRegisterParams,
  journalStatusCounts,
  journalTitle,
  registerTotalLabel,
} from "./_lib/journal-register";

function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

interface RegisterAnswer {
  key: string;
  page: JournalPage | null;
  error: string | null;
}

function JournalEntriesContent() {
  const router = useRouter();
  const [from, setFrom] = useState(startOfMonthISO);
  const [to, setTo] = useState(todayISO);
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [source, setSource] = useState<string>(ANY_SOURCE);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const params = useMemo(
    () =>
      journalRegisterParams({
        from,
        to,
        branchId: branchParam(branch),
        status,
        source,
        search,
        page,
      }),
    [from, to, branch, status, source, search, page],
  );
  const key = journalRegisterKey(params, reload);
  const [answer, setAnswer] = useState<RegisterAnswer | null>(null);

  // One request per settled change, after typing pauses. Only the latest
  // request's answer is kept, so a slow answer never replaces a newer one.
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      accountingService
        .journalsPage(params)
        .then((body) => {
          if (current) setAnswer({ key, page: body, error: null });
        })
        .catch((err: unknown) => {
          if (current) {
            setAnswer({
              key,
              page: null,
              error: getErrorMessage(err, "The journal entries couldn't be loaded."),
            });
          }
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, params]);

  const settled = answer?.key === key;
  // The previous rows stay up, dimmed, until the new page arrives; its figures
  // read as a dash so no total describes filters other than those on screen.
  const rows = answer?.page?.data ?? [];
  const meta = settled ? answer.page?.meta : undefined;
  const failed = settled && answer.error !== null;

  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Journal Entries"
        description="Every entry in the books, automatic and manual."
        actions={
          <PermissionGate permission="journals:create">
            <Button nativeButton={false} render={<Link href="/accounting/journals/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              New Entry
            </Button>
          </PermissionGate>
        }
      />

      <FilterBar>
        <DateFilter label="From" value={from} onChange={changeFilter(setFrom)} />
        <DateFilter label="To" value={to} onChange={changeFilter(setTo)} />
        <BranchFilter value={branch} onChange={changeFilter(setBranch)} />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => changeFilter(setStatus)(v ?? ANY_STATUS)}
            items={journalStatusItems}
          >
            <SelectTrigger className="w-[150px]" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {journalStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Select
            value={source}
            onValueChange={(v) => changeFilter(setSource)(v ?? ANY_SOURCE)}
            items={journalSourceItems}
          >
            <SelectTrigger className="w-[190px]" aria-label="Source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {journalSourceItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="journal-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="journal-search"
              type="search"
              value={search}
              onChange={(e) => changeFilter(setSearch)(e.target.value)}
              placeholder="Number, reference or description"
              className="w-[260px] pl-8"
            />
          </div>
        </div>
      </FilterBar>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {meta ? journalStatusCounts(meta.stats) : "Loading…"}
          </p>

          <div className={settled ? undefined : "opacity-60"} aria-busy={!settled}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-32">Number</TableHead>
                  <TableHead className="w-36">Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Branch</TableHead>
                  <TableHead className="w-32">Source</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-36 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/accounting/journals/${entry.id}`)}
                  >
                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/accounting/journals/${entry.id}`}
                        className="underline-offset-4 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {journalTitle(entry)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <JournalReferenceCell entry={entry} />
                    </TableCell>
                    <TableCell className="text-sm">{entry.description}</TableCell>
                    <TableCell className="text-sm">{entry.branch_name ?? "No branch"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {journalSourceLabel(entry.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <JournalStatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {/* Debits equal credits on a posted entry, so either side is "the amount". */}
                      {formatCentavos(entry.total_debit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-sm font-semibold">
                    {meta ? registerTotalLabel(meta.totals.count, status) : "Register total: —"}
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Total debit {meta ? formatCentavos(meta.totals.total_debit) : "—"} · Total
                      credit {meta ? formatCentavos(meta.totals.total_credit) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {meta ? formatCentavos(meta.totals.total_debit) : "—"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {settled && rows.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {failed ? answer.error : "No journal entry matches these filters."}
            </div>
          )}

          {meta && (
            <TablePagination
              page={page}
              perPage={JOURNAL_PAGE_SIZE}
              total={meta.total}
              perPageOptions={[JOURNAL_PAGE_SIZE]}
              onPageChange={setPage}
              onPerPageChange={() => setPage(1)}
            />
          )}

          {failed && rows.length > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm text-destructive">
              <span>{answer.error}</span>
              <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function JournalEntriesPage() {
  return (
    <RouteGuard permission="journals:view" pageName="Journal Entries">
      <JournalEntriesContent />
    </RouteGuard>
  );
}
