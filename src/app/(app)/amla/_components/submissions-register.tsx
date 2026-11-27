"use client";

import Link from "next/link";
import { useState } from "react";
import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource, usePermission } from "@/hooks";
import { amlaCaseAccess } from "@/lib/amla/case-access";
import { amlaCaseApi } from "@/lib/amla/case-api";
import { amlaDeadlineRow } from "@/lib/amla/case-view";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { once } from "@/lib/amla/once";
import { FilingsList } from "./filings-list";

/**
 * Regulatory Submissions: what is still to file, with the server's deadline
 * on the working-day calendar, and the register of every CTR and STR with its
 * due date, submission date, portal reference and proof (on each report's
 * page). Each tab reads when it is opened.
 */
export function SubmissionsRegister() {
  const [tab, setTab] = useState("due");
  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Regulatory Submissions</h1>
        <p className="text-sm text-muted-foreground">
          Reports are filed by hand on the AMLC portal; each step is recorded here with the portal&apos;s reference and
          evidence. Deadlines are still to verify.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="max-w-full shrink-0 justify-start overflow-x-auto">
          <TabsTrigger value="due">Still to file</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        <TabsContent value="due" className="flex min-h-0 flex-1 flex-col">
          <Deadlines />
        </TabsContent>
        <TabsContent value="register" className="flex min-h-0 flex-1 flex-col gap-3">
          <FilingsList type="" idPrefix="amla-register" />
        </TabsContent>
      </Tabs>
    </PageFill>
  );
}

function Deadlines() {
  const { can } = usePermission();
  const open = { cases: amlaCaseAccess(can).cases, ctr: amlaMonitoringAccess(can).ctr };
  const [fetcher] = useState(() => once(() => amlaCaseApi.deadlines()));
  const resource = useApiResource(fetcher);

  return (
    <DataState
      resource={resource}
      summary="Reports to file, CTRs and STRs still to prepare, with their deadlines."
      endpoints={["GET /amla/filing-deadlines"]}
      isEmpty={(rows) => rows.length === 0}
      emptyMessage="Nothing is waiting to be filed."
      emptyIllustration="allCaughtUp"
    >
      {(rows) => (
        <ScrollBox className={`min-h-0 flex-1 ${VISIBLE_SCROLLBAR}`} tabIndex={0} role="region" aria-label="Filings still to make, scrolls sideways">
          <Table className="min-w-[48rem]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Still to do</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((source) => {
                const row = amlaDeadlineRow(source, open);
                return (
                  <TableRow key={row.key}>
                    <TableCell>
                      {row.href ? (
                        <Link href={row.href} className="font-medium underline-offset-4 hover:underline">
                          {row.reference}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.reference}</span>
                      )}
                    </TableCell>
                    <TableCell>{row.what}</TableCell>
                    <TableCell className="whitespace-normal">{row.status}</TableCell>
                    <TableCell>{row.due}</TableCell>
                    <TableCell>
                      <Badge variant={row.tone}>{row.standing}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollBox>
      )}
    </DataState>
  );
}
