"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaPager } from "@/components/amla/amla-pager";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { AMLA_MATCH_STATUS_OPTIONS, AMLA_MATCH_SUBJECT_OPTIONS, amlaMatchRow } from "@/lib/amla/screening-view";
import type { AmlaOption } from "@/lib/amla/settings-view";

/** Possible matches found by screening, pending first by default. A person decides each; each read is once. */
export function MatchesTab() {
  const [filters, setFilters] = useState({ status: "pending", subject_type: "", page: 1 });
  const fetcher = useMemo(() => once(() => amlaScreeningApi.matches(filters)), [filters]);
  const resource = useApiResource(fetcher);

  const pick = (key: "status" | "subject_type", label: string, every: string, options: readonly AmlaOption[]) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`amla-matches-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect id={`amla-matches-${key}`} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value, page: 1 })}>
        <NativeSelectOption value="">{every}</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-end gap-3 pb-3">
        {pick("status", "Status", "Every status", AMLA_MATCH_STATUS_OPTIONS)}
        {pick("subject_type", "Who", "Everyone", AMLA_MATCH_SUBJECT_OPTIONS)}
      </div>
      <DataState
        resource={resource}
        summary="Possible watchlist matches, with their score and status."
        endpoints={["GET /amla/screening/matches"]}
        isEmpty={(page) => page.meta.total === 0}
        emptyMessage={filters.status === "pending" ? "No match is waiting for review." : "No matches for this selection."}
        emptyIllustration={filters.status === "pending" ? "allCaughtUp" : "noResults"}
      >
        {(page) => (
          <>
            <ScrollBox className="min-h-0 flex-1">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Screened</TableHead>
                    <TableHead>Listed as</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.map(amlaMatchRow).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-normal">
                        <Link href={row.href} className="font-medium underline-offset-4 hover:underline">
                          {row.subject}
                        </Link>
                        <div className="text-xs whitespace-nowrap text-muted-foreground">
                          {row.subjectType} · {row.code}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.listed}
                        <div className="text-xs text-muted-foreground">{row.listing}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.score}</TableCell>
                      <TableCell>
                        <Badge variant={row.pending ? "secondary" : "outline"}>{row.status}</Badge>
                        <div className="text-xs text-muted-foreground">{row.found}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollBox>
            <AmlaPager meta={page.meta} onPage={(next) => setFilters((current) => ({ ...current, page: next }))} />
          </>
        )}
      </DataState>
    </>
  );
}
