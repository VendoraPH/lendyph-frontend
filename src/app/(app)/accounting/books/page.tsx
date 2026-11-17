"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { PageFill } from "@/components/common/page-fill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDateISO, todayISO } from "@/lib/format";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import type { BookKind, ColumnBookKind } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";
import { BookReport } from "./_components/book-report";
import { ColumnBookReport } from "./_components/column-book";
import { BOOK_VIEW_ITEMS, isBookView, type BookView } from "./_lib/column-book";

interface BookTab {
  kind: BookKind;
  label: string;
  summary: string;
  endpoint: string;
  /** The cash books can also be read in columns. */
  columns?: { kind: ColumnBookKind; summary: string; endpoint: string };
}

/**
 * The four books of account a BIR-registered business keeps.
 *
 * Order follows the registration form, not convenience — an examiner reading
 * this expects the journal first and the disbursements book last.
 */
const BOOKS: BookTab[] = [
  {
    kind: "general_journal",
    label: "General Journal",
    summary:
      "Every entry in date order, the way it was recorded, with its debits and credits.",
    endpoint: "GET /accounting/books/general-journal",
  },
  {
    kind: "general_ledger",
    label: "General Ledger",
    summary: "The same entries regrouped under the account each one touched.",
    endpoint: "GET /accounting/books/general-ledger",
  },
  {
    kind: "cash_receipts",
    label: "Cash Receipts",
    summary: "Every peso that came in — collections, capital, anything received.",
    endpoint: "GET /accounting/books/cash-receipts",
    columns: {
      kind: "cash_receipts",
      summary:
        "Every receipt on one line, its money split into a column per account it went to.",
      endpoint: "GET /accounting/books/cash-receipts/columns",
    },
  },
  {
    kind: "cash_disbursements",
    label: "Cash Disbursements",
    summary: "Every peso that went out — releases, expenses, withdrawals.",
    endpoint: "GET /accounting/books/cash-disbursements",
    columns: {
      kind: "cash_disbursements",
      summary:
        "Every disbursement on one line, its money split into a column per account it came from.",
      endpoint: "GET /accounting/books/cash-disbursements/columns",
    },
  },
];

function startOfMonthISO(): string {
  const now = new Date();
  return formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
}

function BookViewSwitch({
  value,
  onChange,
}: {
  value: BookView;
  onChange: (view: BookView) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Book layout"
      variant="outline"
      size="sm"
      value={[value]}
      onValueChange={(next) => {
        if (isBookView(next[0])) onChange(next[0]);
      }}
    >
      {BOOK_VIEW_ITEMS.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value}>
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export default function AccountingBooksPage() {
  const [tab, setTab] = useState<string>(BOOKS[0].kind);
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [view, setView] = useState<BookView>("columns");

  const branchId = branchParam(branch);
  // The layout switch sits beside the tabs, for the books that have one.
  const activeHasColumns = BOOKS.some((book) => book.kind === tab && book.columns);

  return (
    <RouteGuard permission="accounting:view" pageName="Accounting Books">
      <PageFill className="gap-4">
        <AccountingPageHeader
          title="Accounting Books"
          description="The books of account, kept automatically from posted entries."
        />

        <div className="shrink-0 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          These are generated from posted journal entries, so they never
          disagree with the ledger. Nothing here is typed in by hand.
        </div>

        <FilterBar>
          <DateFilter label="From" value={from} onChange={setFrom} />
          <DateFilter label="To" value={to} onChange={setTo} />
          <BranchFilter value={branch} onChange={setBranch} />
        </FilterBar>

        <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className={FIT_CLASSES.section}>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2">
            <TabsList className="max-w-full justify-start overflow-x-auto">
              {BOOKS.map((book) => (
                <TabsTrigger key={book.kind} value={book.kind}>
                  {book.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeHasColumns && <BookViewSwitch value={view} onChange={setView} />}
          </div>

          {BOOKS.map((book) => (
            <TabsContent key={book.kind} value={book.kind} className={cn("mt-2 min-w-0", FIT_CLASSES.section)}>
              {book.columns && view === "columns" ? (
                <ColumnBookReport
                  title={book.label}
                  kind={book.columns.kind}
                  from={from}
                  to={to}
                  branchId={branchId}
                  summary={book.columns.summary}
                  endpoint={book.columns.endpoint}
                />
              ) : (
                <BookReport
                  title={book.label}
                  kind={book.kind}
                  from={from}
                  to={to}
                  branchId={branchId}
                  summary={book.summary}
                  endpoint={book.endpoint}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </PageFill>
    </RouteGuard>
  );
}
