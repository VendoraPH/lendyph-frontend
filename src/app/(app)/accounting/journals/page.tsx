"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate, RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, todayISO } from "@/lib/format";
import type { DrainResult } from "@/lib/paginate";
import type { JournalEntry, JournalStatus } from "@/types";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";
import { JournalEntryDialog } from "../_components/journal-entry-dialog";

const ANY_STATUS = "any";

const STATUS_STYLES: Record<JournalStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  posted: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  reversed: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function JournalEntriesPage() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  const fetcher = useCallback(
    () =>
      // Drained: the register showed the endpoint's default 15 entries as
      // though they were every journal in the range.
      accountingService.journalsListAll({
        from,
        to,
        branch_id: branchParam(branch),
        status: status === ANY_STATUS ? undefined : (status as JournalStatus),
      }),
    [from, to, branch, status],
  );
  const resource = useAccountingResource<DrainResult<JournalEntry>>(fetcher);

  const post = async (entry: JournalEntry) => {
    try {
      await accountingService.postJournal(entry.id);
      toast.success(`${entry.reference || "Entry"} posted.`);
      setSelected(null);
      resource.refetch();
    } catch {
      toast.error("Could not post this entry.");
    }
  };

  const reverse = async (entry: JournalEntry, reason: string) => {
    try {
      await accountingService.reverseJournal(entry.id, todayISO(), reason);
      toast.success("Reversing entry created. The original is unchanged.");
      setSelected(null);
      resource.refetch();
    } catch {
      toast.error("Could not reverse this entry.");
    }
  };

  return (
    <RouteGuard permission="journals:view" pageName="Journal Entries">
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
          <DateFilter label="From" value={from} onChange={setFrom} />
          <DateFilter label="To" value={to} onChange={setTo} />
          <BranchFilter value={branch} onChange={setBranch} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? ANY_STATUS)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_STATUS}>Any status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <DataState
          resource={resource}
          summary="The journal register: entries raised automatically by lending events alongside manual ones, with drafting, posting and reversal."
          endpoints={[
            "GET /accounting/journals",
            "POST /accounting/journals",
            "POST /accounting/journals/{id}/post",
            "POST /accounting/journals/{id}/reverse",
          ]}
          isEmpty={(drain) => drain.rows.length === 0}
          emptyMessage="No journal entry in the chosen range."
        >
          {({ rows, truncated, total }) => (
            <Card>
              <CardContent className="space-y-4 pt-6">
                {truncated && (
                  <IncompleteListNotice
                    shown={rows.length}
                    total={total}
                    noun="journal entries"
                    consequence="Entries missing from this register cannot be opened, posted or reversed from here."
                  />
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead className="w-32">Reference</TableHead>
                      <TableHead>Description</TableHead>
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
                        onClick={() => setSelected(entry)}
                      >
                        <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.reference || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{entry.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.source.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLES[entry.status]}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {/* Debits equal credits, so either side is "the amount". */}
                          {formatCentavos(entry.total_debit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </DataState>

        <JournalEntryDialog
          entry={selected}
          onOpenChange={(open) => !open && setSelected(null)}
          onPost={post}
          onReverse={reverse}
        />
      </div>
    </RouteGuard>
  );
}
