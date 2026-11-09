"use client";

import { useCallback, useMemo, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate, RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDate, formatDateTime } from "@/lib/format";
import type { DrainResult } from "@/lib/paginate";
import type { AccountingPeriod, YearClose, YearClosePage } from "@/types";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { periodStatusLabel } from "../_lib/display-labels";
import { YearCloseHistory } from "./_components/year-close-history";
import { YearEndCloseSection } from "./_components/year-end-close-section";
import { REOPEN_THE_YEAR, monthAction, periodReopenFailure } from "./_lib/month-actions";
import { periodYearEndLabels } from "./_lib/year-close";

const NO_CLOSES: YearClose[] = [];

function PeriodClosingContent() {
  const [confirming, setConfirming] = useState<AccountingPeriod | null>(null);

  // Drained. A co-op live since 2024 already has more than 15 monthly periods,
  // and the ones past the first page are the OLD ones — exactly the periods
  // someone opens this screen to close.
  const fetcher = useCallback(() => accountingService.periodsListAll(), []);
  const resource = useAccountingResource<DrainResult<AccountingPeriod>>(fetcher);

  // The year closes, newest first, up to the API's 100: which months a close
  // closed, which years are closed, and the latest one (the only one that can
  // reopen). The history below pages on its own. If this fails, the months
  // simply don't say which close closed them.
  const closesFetcher = useCallback(
    () => accountingService.yearClosesPage({ page: 1, per_page: 100 }),
    [],
  );
  const closesResource = useAccountingResource<YearClosePage>(closesFetcher);
  const closes = closesResource.data?.data ?? NO_CLOSES;
  const yearEndLabels = useMemo(() => periodYearEndLabels(closes), [closes]);

  // A close or a reopen changes the months, the closes, the preview and the
  // history: refetch the first two and remount the year-end cards.
  const [yearEndVersion, setYearEndVersion] = useState(0);
  const refetchPeriods = resource.refetch;
  const refetchCloses = closesResource.refetch;
  const yearEndChanged = useCallback(() => {
    refetchPeriods();
    refetchCloses();
    setYearEndVersion((v) => v + 1);
  }, [refetchPeriods, refetchCloses]);

  const close = async (period: AccountingPeriod) => {
    try {
      await accountingService.closePeriod(period.id);
      toast.success(`${period.name} closed.`);
      setConfirming(null);
      resource.refetch();
    } catch {
      toast.error("Could not close this period.");
    }
  };

  const reopen = async (period: AccountingPeriod) => {
    try {
      await accountingService.reopenPeriod(period.id);
      toast.success(`${period.name} reopened.`);
      resource.refetch();
    } catch (err) {
      toast.error(periodReopenFailure(err));
    }
  };

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Period Closing"
        description="Lock a month once it has been reviewed, and close the year once its books are final."
      />

      {/*
        Closing is presented as the review step it is, not as a button that
        tidies something up. Once a month is closed, nothing can be posted
        into it — which is the whole value, and also why reopening exists
        and is logged.
      */}
      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Closing a period stops anything further being posted into it. Do it
        once the trial balance is in balance and the money accounts have been
        reconciled.
      </div>

      <DataState
        resource={resource}
        summary="Each accounting period, whether it is still accepting entries, and who closed it."
        endpoints={[
          "GET /accounting/periods",
          "POST /accounting/periods/{id}/close",
          "POST /accounting/periods/{id}/reopen",
        ]}
        isEmpty={(drain) => drain.rows.length === 0}
        emptyMessage="No accounting period has been set up."
      >
        {({ rows: periods, truncated, total }) => (
          <Card>
            <CardContent className="space-y-4 pt-6">
              {truncated && (
                <IncompleteListNotice
                  shown={periods.length}
                  total={total}
                  noun="accounting periods"
                  consequence="A period missing from this table cannot be closed or reopened from here."
                />
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Period</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-56">Dates</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-56">Closed</TableHead>
                    <TableHead className="w-44" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-mono text-xs">
                        {period.code}
                      </TableCell>
                      <TableCell className="text-sm">{period.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(period.start_date)} –{" "}
                        {formatDate(period.end_date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            period.status === "open"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                              : "bg-slate-500/10 text-slate-700 border-slate-500/30"
                          }
                        >
                          {period.status === "open" ? (
                            <LockOpen className="mr-1 h-3 w-3" />
                          ) : (
                            <Lock className="mr-1 h-3 w-3" />
                          )}
                          {periodStatusLabel(period.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {yearEndLabels.has(period.id) && (
                          <p className="font-medium text-foreground">
                            {yearEndLabels.get(period.id)}
                          </p>
                        )}
                        {period.closed_at
                          ? `${formatDateTime(period.closed_at)}${
                              period.closed_by ? ` · ${period.closed_by}` : ""
                            }`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <PermissionGate permission="accounting:close">
                          {monthAction(period, yearEndLabels) === "close" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirming(period)}
                            >
                              Close
                            </Button>
                          )}
                          {monthAction(period, yearEndLabels) === "reopen" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => reopen(period)}
                            >
                              Reopen
                            </Button>
                          )}
                          {monthAction(period, yearEndLabels) === "year" && (
                            <span className="text-xs text-muted-foreground">
                              {REOPEN_THE_YEAR}
                            </span>
                          )}
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </DataState>

      <PermissionGate permission="accounting:close">
        {resource.data && !closesResource.loading && (
          <YearEndCloseSection
            key={`close-${yearEndVersion}`}
            periods={resource.data.rows}
            closes={closes}
            onChanged={yearEndChanged}
          />
        )}
        <YearCloseHistory
          key={`history-${yearEndVersion}`}
          closes={closes}
          onChanged={yearEndChanged}
        />
      </PermissionGate>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {confirming?.name}?</DialogTitle>
            <DialogDescription>
              No entry can be posted into this period afterwards. It can be
              reopened, and reopening is recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirming && close(confirming)}>
              Close period
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PeriodClosingPage() {
  return (
    <RouteGuard permission="accounting:close" pageName="Period Closing">
      <PeriodClosingContent />
    </RouteGuard>
  );
}
