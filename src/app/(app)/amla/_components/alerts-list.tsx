"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaFilterField } from "@/components/amla/amla-filter-field";
import { AmlaPager } from "@/components/amla/amla-pager";
import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { useBranchFilter, useBranchScopedFilters } from "@/hooks/use-working-branch";
import { amlaMonitoringApi, type AmlaAlertFilters } from "@/lib/amla/monitoring-api";
import { AMLA_ALERT_STATUS_OPTIONS, AMLA_DETECTION_RULE_OPTIONS, AMLA_PRIORITY_OPTIONS, amlaAlertRow } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import type { AmlaOption } from "@/lib/amla/settings-view";

type Draft = Omit<AmlaAlertFilters, "branch_id" | "page" | "per_page">;

const START: Draft = { status: "open", rule: "", priority: "", from: "", to: "", search: "" };

/**
 * Alerts in the caller's branches (head office: every branch, walk-ins and
 * cross-branch), newest first. The server logs each read, so filters apply on
 * "Show" and each Show or page reads once. The branch follows the working
 * branch until it is picked here.
 */
export function AlertsList() {
  const [draft, setDraft] = useState(START);
  const [branch, setBranch] = useBranchFilter();
  const [applied, setApplied] = useBranchScopedFilters<AmlaAlertFilters>(() => ({ ...START, page: 1 }));
  const fetcher = useMemo(() => once(() => amlaMonitoringApi.alerts(applied)), [applied]);
  const resource = useApiResource(fetcher);
  const set = (key: keyof Draft) => (value: string) => setDraft({ ...draft, [key]: value });

  const pick = (key: keyof Draft, label: string, every: string, options: readonly AmlaOption[]) => (
    <AmlaFilterField id={`amla-alerts-${key}`} label={label}>
      <NativeSelect id={`amla-alerts-${key}`} value={draft[key]} onChange={(e) => set(key)(e.target.value)}>
        <NativeSelectOption value="">{every}</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </AmlaFilterField>
  );

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Transactions the detection rules flagged for a person to review. Nothing is filed, blocked or frozen by itself.
        </p>
      </div>

      <form
        className="flex shrink-0 flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...draft, branch_id: branchIdParam(branch), page: 1 });
        }}
      >
        {pick("status", "Status", "Every status", AMLA_ALERT_STATUS_OPTIONS)}
        {pick("priority", "Priority", "Every priority", AMLA_PRIORITY_OPTIONS)}
        {pick("rule", "Rule", "Every rule", AMLA_DETECTION_RULE_OPTIONS)}
        <AmlaFilterField id="amla-alerts-from" label="Detected from">
          <Input id="amla-alerts-from" type="date" value={draft.from} onChange={(e) => set("from")(e.target.value)} />
        </AmlaFilterField>
        <AmlaFilterField id="amla-alerts-to" label="To">
          <Input id="amla-alerts-to" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set("to")(e.target.value)} />
        </AmlaFilterField>
        <AmlaFilterField id="amla-alerts-search" label="Reference">
          <Input id="amla-alerts-search" type="search" value={draft.search} maxLength={40} className="w-44" onChange={(e) => set("search")(e.target.value)} />
        </AmlaFilterField>
        <BranchFilter value={branch} onChange={setBranch} />
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>

      <FillSection>
        <DataState
          resource={resource}
          summary="AMLA alerts, with their rule, priority, subject and transactions."
          endpoints={["GET /amla/alerts"]}
          isEmpty={(page) => page.meta.total === 0}
          emptyMessage="No alerts match this selection."
          emptyIllustration="allCaughtUp"
        >
          {(page) => (
            <>
              <ScrollBox className={`min-h-0 flex-1 ${VISIBLE_SCROLLBAR}`} tabIndex={0} role="region" aria-label="Alerts, scrolls sideways">
                <Table className="min-w-[48rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert</TableHead>
                      <TableHead>Priority and status</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map(amlaAlertRow).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={row.href} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                            {row.reference}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {row.rule} · {row.version}
                          </div>
                          {row.history && <div className="text-xs text-muted-foreground">{row.history}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.tone}>{row.priority}</Badge>
                          <div className="text-xs text-muted-foreground">{row.status}</div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.subject}
                          <div className="text-xs whitespace-nowrap text-muted-foreground">{row.code}</div>
                        </TableCell>
                        <TableCell>{row.branch}</TableCell>
                        <TableCell className="whitespace-normal">
                          {row.window}
                          <div className="text-xs text-muted-foreground">{row.transactions}</div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{row.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
              <AmlaPager meta={page.meta} onPage={(next) => setApplied((current) => ({ ...current, page: next }))} />
            </>
          )}
        </DataState>
      </FillSection>
    </PageFill>
  );
}
