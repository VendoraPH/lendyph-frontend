"use client";

import Link from "next/link";
import { useState } from "react";
import { AmlaFilterField } from "@/components/amla/amla-filter-field";
import { BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiResource, usePermission } from "@/hooks";
import { useBranchFilter } from "@/hooks/use-working-branch";
import { todayISO } from "@/lib/format";
import { notifyWarning } from "@/lib/notify";
import { once } from "@/lib/amla/once";
import { amlaReportApi } from "@/lib/amla/report-api";
import { amlaDefaultRange, amlaReportRangeError } from "@/lib/amla/report-view";
import type { AmlaComplianceReportFilters, AmlaComplianceReportSummary } from "@/types/amla-reports";
import { ComplianceReportExports } from "./compliance-report-exports";
import { ComplianceReportTable } from "./compliance-report-table";

/**
 * One AMLA report, built and formatted by the server. A period report asks
 * for a date range (this month to today until changed); an as-of-today report
 * takes only the branch. The server logs each read, so nothing is read until
 * Show is pressed, and each Show reads once: a header branch switch moves the
 * branch picker but never reads. An export is of what is shown.
 */
export function ComplianceReportView({ summary }: { summary: AmlaComplianceReportSummary }) {
  const { can } = usePermission();
  const [range, setRange] = useState(() => (summary.uses_period ? amlaDefaultRange(todayISO()) : { from: "", to: "" }));
  const [branch, setBranch] = useBranchFilter();
  // The filters of the report on screen, null until the first Show; each Show counts a run.
  const [applied, setApplied] = useState<AmlaComplianceReportFilters | null>(null);
  const [run, setRun] = useState(0);

  return (
    <PageFill>
      <div className="shrink-0">
        <Link href="/amla/reports" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          AMLA Reports
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{summary.title}</h1>
        <p className="text-sm text-muted-foreground">{summary.description}</p>
      </div>

      <form
        className="flex shrink-0 flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const problem = summary.uses_period ? amlaReportRangeError(range.from, range.to) : null;
          if (problem !== null) {
            notifyWarning(problem);
            return;
          }
          setApplied({ ...range, branch_id: branchIdParam(branch) });
          setRun((n) => n + 1);
        }}
      >
        {summary.uses_period && (
          <>
            <AmlaFilterField id="amla-report-from" label="From">
              <Input id="amla-report-from" type="date" required value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </AmlaFilterField>
            <AmlaFilterField id="amla-report-to" label="To">
              <Input id="amla-report-to" type="date" required value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </AmlaFilterField>
          </>
        )}
        <BranchFilter value={branch} onChange={setBranch} />
        <Button type="submit" variant="outline">
          Show
        </Button>
        {applied !== null && can("amla:export") && <ComplianceReportExports reportKey={summary.key} filters={applied} />}
      </form>

      <FillSection>
        {applied === null ? (
          <ReportNotShownYet usesPeriod={summary.uses_period} />
        ) : (
          <ComplianceReportRead key={run} summary={summary} filters={applied} />
        )}
      </FillSection>
    </PageFill>
  );
}

/** Before the first Show: what to press, and that each read is logged. */
function ReportNotShownYet({ usesPeriod }: { usesPeriod: boolean }) {
  return (
    <Card className="shrink-0">
      <CardContent className="space-y-1 py-10 text-center text-sm text-muted-foreground">
        <p>{usesPeriod ? "Pick the dates and press Show." : "Press Show to see today's figures."}</p>
        <p>Each report you open is recorded in the AMLA log.</p>
      </CardContent>
    </Card>
  );
}

/**
 * One Show's read. The view keys it on its run counter, so each Show mounts it
 * afresh and it reads exactly once (`once` also covers StrictMode's second
 * effect in development).
 */
function ComplianceReportRead({ summary, filters }: { summary: AmlaComplianceReportSummary; filters: AmlaComplianceReportFilters }) {
  const [fetcher] = useState(() => once(() => amlaReportApi.report(summary.key, filters)));
  const resource = useApiResource(fetcher);

  return (
    <DataState resource={resource} summary={`${summary.title}, as the server builds it.`} endpoints={[`GET /amla/compliance-reports/${summary.key}`]}>
      {(report) => (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{report.period}</span>
            {report.draft && (
              <>
                <Badge variant="secondary">Draft</Badge>
                <span className="text-muted-foreground">The period hasn&apos;t ended, so these figures can still change.</span>
              </>
            )}
          </div>
          <ComplianceReportTable report={report} />
        </>
      )}
    </DataState>
  );
}
