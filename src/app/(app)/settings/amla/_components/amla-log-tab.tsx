"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { amlaApi, type AmlaLogFilters } from "@/lib/amla/api";
import { AMLA_LOG_ACTION_OPTIONS, amlaLogRow } from "@/lib/amla/settings-view";
import { AmlaPager } from "./amla-pager";

const NO_FILTERS: AmlaLogFilters = { action: "", from: "", to: "", page: 1 };

/**
 * AMLA's own log, kept forever and separate from the main audit trail. The
 * server logs every read of it, so filters apply on "Show", not on each change.
 */
export function AmlaLogTab() {
  const [draft, setDraft] = useState(NO_FILTERS);
  const [applied, setApplied] = useState(NO_FILTERS);
  const fetcher = useCallback(() => amlaApi.log(applied), [applied]);
  const resource = useApiResource(fetcher);

  return (
    <>
      <form
        className="flex shrink-0 flex-wrap items-end gap-3 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...draft, page: 1 });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="amla-log-action">Action</Label>
          <NativeSelect id="amla-log-action" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
            <NativeSelectOption value="">Every action</NativeSelectOption>
            {AMLA_LOG_ACTION_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="amla-log-from">From</Label>
          <Input id="amla-log-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="amla-log-to">To</Label>
          <Input id="amla-log-to" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>
      <p className="shrink-0 pb-2 text-xs text-muted-foreground">
        Kept forever. Opening this log is itself recorded in it. Times are Philippine time.
      </p>
      <DataState
        resource={resource}
        summary="AMLA's own log of changes, refusals and reads."
        endpoints={["GET /amla/log"]}
        isEmpty={(page) => page.data.length === 0}
        emptyMessage="Nothing in the AMLA log for this selection."
        emptyIllustration="noResults"
      >
        {(page) => (
          <>
            <ScrollBox className="min-h-0 flex-1">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.map(amlaLogRow).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.when}</TableCell>
                      <TableCell>{row.who}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.subject}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollBox>
            <AmlaPager meta={page.meta} onPage={(next) => setApplied({ ...applied, page: next })} />
          </>
        )}
      </DataState>
    </>
  );
}
