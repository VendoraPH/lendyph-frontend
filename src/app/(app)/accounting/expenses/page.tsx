"use client";

import { useCallback, useMemo, useState } from "react";
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
import { formatCentavos, sumCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { DrainResult } from "@/lib/paginate";
import type { Expense, ExpenseStatus } from "@/types";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { FilterBar } from "../_components/accounting-filters";
import { ExpenseDialog } from "../_components/expense-dialog";

const ANY_STATUS = "any";

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  unpaid: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  partially_paid: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  overdue: "bg-red-500/10 text-red-700 border-red-500/30",
};

export default function ExpensesPage() {
  const [status, setStatus] = useState(ANY_STATUS);
  const [creating, setCreating] = useState(false);

  // Drained. `listExpenses()` read one page of 15 and the card below totalled
  // it into "Outstanding", so a co-op with 40 open payables was shown the sum
  // of the first fifteen in headline type with nothing marking it partial.
  const fetcher = useCallback(() => accountingService.expensesListAll(), []);
  const resource = useAccountingResource<DrainResult<Expense>>(fetcher);

  const create = async (data: Partial<Expense>) => {
    try {
      await accountingService.createExpense(data);
      toast.success("Expense recorded.");
      setCreating(false);
      resource.refetch();
    } catch {
      toast.error("Could not record this expense.");
    }
  };

  return (
    <RouteGuard permission="expenses:view" pageName="Expenses & Payables">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Expenses & Payables"
          description="Operating costs, paid and owed."
          actions={
            <PermissionGate permission="expenses:create">
              <Button onClick={() => setCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Expense
              </Button>
            </PermissionGate>
          }
        />

        <FilterBar>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? ANY_STATUS)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_STATUS}>Any status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partially_paid">Partially paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <DataState
          resource={resource}
          summary="Recording expenses against a cash account or as a payable, and settling payables."
          endpoints={[
            "GET /accounting/expenses",
            "POST /accounting/expenses",
            "POST /accounting/expenses/{id}/pay",
          ]}
          isEmpty={(drain) => drain.rows.length === 0}
          emptyMessage="No expense recorded yet."
        >
          {(drain) => (
            <ExpenseTable
              rows={drain.rows}
              status={status}
              truncated={drain.truncated}
              total={drain.total}
            />
          )}
        </DataState>

        <ExpenseDialog
          open={creating}
          onOpenChange={setCreating}
          onSubmit={create}
        />
      </div>
    </RouteGuard>
  );
}

/**
 * Split out so the filtering memo is not re-created on every parent render,
 * and so the page component stays about page concerns.
 */
function ExpenseTable({
  rows,
  status,
  truncated,
  total,
}: {
  rows: Expense[];
  status: string;
  truncated: boolean;
  total: number | null;
}) {
  const filtered = useMemo(
    () => (status === ANY_STATUS ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  const outstanding = useMemo(
    () => sumCentavos(filtered.map((r) => r.amount - r.amount_paid)),
    [filtered],
  );

  // The status filter narrows what is already in hand, so a short list makes
  // every one of these figures short too — including the filtered ones.
  const notice = truncated ? (
    <IncompleteListNotice
      shown={rows.length}
      total={total}
      noun="expenses"
      consequence="Outstanding is the total of the expenses listed here, not of every expense on file."
    />
  ) : null;

  if (filtered.length === 0) {
    return (
      <div className="space-y-4">
        {notice}
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No expense matches this status.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">Outstanding</span>
          <span className="font-mono text-xl font-semibold">
            {formatCentavos(outstanding)}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="w-28">Due</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-32 text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-sm">{formatDate(expense.date)}</TableCell>
                  <TableCell className="text-sm">{expense.payee}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expense.expense_account_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {expense.due_date ? formatDate(expense.due_date) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[expense.status]}>
                      {expense.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCentavos(expense.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    {formatCentavos(expense.amount - expense.amount_paid)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
