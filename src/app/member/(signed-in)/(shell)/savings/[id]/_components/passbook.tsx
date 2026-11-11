"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { Pager } from "@/components/portal/pager";
import { SectionCard } from "@/components/portal/section-card";
import { formatDate, todayISO } from "@/lib/format";
import { isNilAmount } from "@/lib/savings/amount-text";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NONE, SAVINGS_TRANSACTION, labelOf } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";

interface Filters {
  from: string;
  to: string;
  type: string;
  search: string;
}

const EMPTY: Filters = { from: "", to: "", type: "", search: "" };

/** The passbook: the server's lines with the balance after each, and the opening balance before `from`. */
export function Passbook({ accountId }: { accountId: number }) {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const fetcher = useCallback(
    () =>
      portalService.passbook(accountId, page, {
        from: applied.from || undefined,
        to: applied.to || undefined,
        type: applied.type || undefined,
        search: applied.search.trim() || undefined,
      }),
    [accountId, page, applied],
  );
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the passbook. Please try again.");

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  };

  return (
    <SectionCard title="Passbook">
      <form onSubmit={apply} className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5 md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="pb-from">From</Label>
          <Input id="pb-from" type="date" max={todayISO()} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pb-to">To</Label>
          <Input id="pb-to" type="date" max={todayISO()} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pb-type">Type</Label>
          <NativeSelect id="pb-type" className="w-full" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <NativeSelectOption value="">All</NativeSelectOption>
            {Object.entries(SAVINGS_TRANSACTION).map(([key, label]) => (
              <NativeSelectOption key={key} value={key}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pb-search">Reference</Label>
          <Input id="pb-search" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        </div>
        <Button type="submit" variant="outline" className="col-span-2 md:col-span-1">
          Show
        </Button>
      </form>
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="No transactions for this selection.">
        {data && (
          <>
            {applied.from && (
              <p className="mb-2 text-xs text-muted-foreground">
                Balance before {formatDate(applied.from)}: <Money value={data.meta.opening_balance} />
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Date</TableHead>
                  <TableHead scope="col">Type</TableHead>
                  <TableHead scope="col" className="text-right">In</TableHead>
                  <TableHead scope="col" className="text-right">Out</TableHead>
                  <TableHead scope="col" className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row, index) => (
                  <TableRow key={`${row.reference ?? "line"}-${index}`}>
                    <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                    <TableCell className="min-w-32">
                      {labelOf(SAVINGS_TRANSACTION, row.type)}
                      {row.reference && <span className="block text-xs text-muted-foreground">{row.reference}</span>}
                    </TableCell>
                    <TableCell className="text-right">{isNilAmount(row.credit) ? NONE : <Money value={row.credit} />}</TableCell>
                    <TableCell className="text-right">{isNilAmount(row.debit) ? NONE : <Money value={row.debit} />}</TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={row.balance_after} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        )}
      </LoadState>
    </SectionCard>
  );
}
