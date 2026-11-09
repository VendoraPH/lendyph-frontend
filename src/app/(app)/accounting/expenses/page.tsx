"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PermissionGate, RouteGuard, TablePagination } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountingResource } from "@/hooks";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/use-search-page";
import { notifyError, notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { PayExpenseData } from "@/services/accounting.service";
import type { Expense, ExpensePage } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { FilterBar } from "../_components/accounting-filters";
import { EditExpenseDialog, ExpenseDialog } from "../_components/expense-dialog";
import { PayExpenseDialog } from "../_components/pay-expense-dialog";
import { ANY_STATUS, expenseStatusItems } from "../_lib/select-items";
import { centavosOrDash } from "../_lib/server-figure";
import type { ExpenseEditPayload } from "./_lib/expense-forms";
import {
  EXPENSE_PAGE_SIZE,
  expenseListQuery,
  expensePageToStepBackTo,
  expenseStatusCounts,
} from "./_lib/expense-list";
import { ExpenseTable } from "./_components/expense-table";

function ExpensesContent() {
  const [status, setStatus] = useState(ANY_STATUS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);

  // The search goes to the server once typing settles, from page one.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // One server page. The rows, the cards and the counts all come from its
  // answer: `meta.totals` over every matching expense and `meta.stats` per
  // status, never a sum of the rows in hand.
  const query = useMemo(() => expenseListQuery({ status, search, page }), [status, search, page]);
  const fetcher = useCallback(() => accountingService.expensesPage(query), [query]);
  const resource = useAccountingResource<ExpensePage>(fetcher);
  const { data, loading, refetch } = resource;

  // A payment or a filter can leave this page past the end: step back.
  const stepBack =
    data && !loading
      ? expensePageToStepBackTo({
          rows: (data.data ?? []).length,
          page,
          lastPage: data.meta?.last_page,
        })
      : null;
  if (stepBack !== null) setPage(stepBack);

  // The previous page stays up, dimmed, while the next one loads; only the
  // first load shows the loading panel.
  const shownResource = { ...resource, loading: loading && data === null };

  const create = async (input: Partial<Expense>) => {
    try {
      await accountingService.createExpense(input);
      notifySuccess("Expense recorded");
      setCreating(false);
      refetch();
    } catch (err) {
      notifyError(err, "Could not record this expense.");
    }
  };

  const pay = async (expense: Expense, input: PayExpenseData) => {
    try {
      await accountingService.payExpense(expense.id, input);
    } catch (err) {
      notifyError(err, "Could not pay this expense.");
      throw err;
    }
    notifySuccess("Payment recorded");
    setPaying(null);
    refetch();
  };

  const update = async (expense: Expense, input: ExpenseEditPayload) => {
    try {
      await accountingService.updateExpense(expense.id, input);
    } catch (err) {
      notifyError(err, "Could not save this expense.");
      throw err;
    }
    notifySuccess("Expense updated");
    setEditing(null);
    refetch();
  };

  const filtered = status !== ANY_STATUS || search.trim() !== "";

  return (
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
          <Label htmlFor="expense-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="expense-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Payee or reference"
              className="w-[240px] pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v ?? ANY_STATUS);
              setPage(1);
            }}
            items={expenseStatusItems}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {expenseStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      <DataState
        resource={shownResource}
        summary="Recording expenses against a cash account or as a payable, and settling payables."
        endpoints={[
          "GET /accounting/expenses",
          "POST /accounting/expenses",
          "PUT /accounting/expenses/{id}",
          "POST /accounting/expenses/{id}/pay",
        ]}
      >
        {(answer) => {
          const totals = loading ? undefined : answer.meta?.totals;
          const counts = loading ? [] : expenseStatusCounts(answer.meta?.stats);
          const rows = answer.data ?? [];
          return (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Figure label="Recorded" value={totals?.amount} />
                <Figure label="Paid" value={totals?.amount_paid} />
                <Figure label="Outstanding" value={totals?.amount_due} emphasis />
              </div>

              {counts.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {counts.map((c) => `${c.count} ${c.label.toLowerCase()}`).join(" · ")}
                  {search.trim() ? ", matching the search" : ""}
                </p>
              )}

              <Card aria-busy={loading}>
                <CardContent className={loading ? "pt-6 opacity-60 transition-opacity" : "pt-6 transition-opacity"}>
                  {rows.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      {filtered ? "No expense matches these filters." : "No expense recorded yet."}
                    </p>
                  ) : (
                    <ExpenseTable rows={rows} onPay={setPaying} onEdit={setEditing} />
                  )}
                  {typeof answer.meta?.total === "number" && answer.meta.total > 0 && (
                    <TablePagination
                      page={page}
                      perPage={EXPENSE_PAGE_SIZE}
                      total={answer.meta.total}
                      perPageOptions={[EXPENSE_PAGE_SIZE]}
                      onPageChange={setPage}
                      onPerPageChange={() => setPage(1)}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }}
      </DataState>

      <ExpenseDialog open={creating} onOpenChange={setCreating} onSubmit={create} />
      <PayExpenseDialog
        expense={paying}
        onOpenChange={(open) => !open && setPaying(null)}
        onSubmit={pay}
      />
      <EditExpenseDialog
        expense={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={update}
      />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <RouteGuard permission="expenses:view" pageName="Expenses & Payables">
      <ExpensesContent />
    </RouteGuard>
  );
}

/** One of the server's totals; a dash while it isn't there. */
function Figure({ label, value, emphasis = false }: { label: string; value?: number; emphasis?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={emphasis ? "font-mono text-xl font-semibold" : "font-mono text-lg"}>
          {centavosOrDash(value)}
        </span>
      </CardContent>
    </Card>
  );
}
