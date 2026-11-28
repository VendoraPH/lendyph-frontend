"use client";

import { useCallback } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { useApiResource, usePermission } from "@/hooks";
import { cicService } from "@/services";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CicReadiness, CicReadinessCount } from "@/types/cic";
import { CicPageHeader } from "./_components/page-header";
import { ReferenceDateField } from "./_components/reference-date-field";
import { useReferenceDate } from "./_components/reference-date";
import { SubmissionStatusBadge } from "./_components/submission-status-badge";
import { CicGuard } from "./_components/cic-guard";

function CountCard({ label, count }: { label: string; count: CicReadinessCount }) {
  const percent = count.total === 0 ? null : Math.floor((count.ready / count.total) * 100);
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {count.ready} <span className="text-base font-normal text-muted-foreground">of {count.total} ready</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {percent === null ? "None to report." : `${percent}% ready · ${count.with_errors} with errors`}
        </p>
      </CardContent>
    </Card>
  );
}

function ReadinessBody({ data }: { data: CicReadiness }) {
  const { can } = usePermission();
  return (
    <div className="space-y-6">
      {data.unmapped_products > 0 && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {data.unmapped_products} loan {data.unmapped_products === 1 ? "product is" : "products are"} not mapped to a CIC
            contract type
          </AlertTitle>
          <AlertDescription>
            Their loans are left out of the file.
            {can("cic:settings") && (
              <>
                {" "}
                <Link href="/settings/cic" className="underline">
                  Map them in CIC Settings.
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CountCard label="Subjects (members and businesses)" count={data.subjects} />
        <CountCard label="Contracts (loans)" count={data.contracts} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What Holds Records Back</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No missing or invalid fields.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_issues.map((i) => (
                    <TableRow key={i.field_id}>
                      <TableCell>
                        <span className="font-mono text-xs">{i.field_id}</span> {i.field_name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{i.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Submission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.last_submission ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/cic/submissions/${data.last_submission.id}`} className="font-medium underline">
                    {data.last_submission.filename}
                  </Link>
                  <SubmissionStatusBadge status={data.last_submission.status} />
                </div>
                <p className="text-muted-foreground">
                  Reference date {formatDate(data.last_submission.file_reference_date)} ·{" "}
                  {data.last_submission.record_count} records · generated{" "}
                  {formatDateTime(data.last_submission.created_at)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No file has been generated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CicDashboardContent() {
  const [referenceDate, setReferenceDate] = useReferenceDate();
  const { can } = usePermission();
  const fetcher = useCallback(() => cicService.getReadiness(referenceDate), [referenceDate]);
  const resource = useApiResource<CicReadiness>(fetcher);

  return (
    <PageFill>
      <CicPageHeader
        title="CIC Data Readiness"
        description="How much of the Credit Submission Data File is ready to send to the Credit Information Corporation."
        actions={
          <>
            <ReferenceDateField value={referenceDate} onChange={setReferenceDate} max={todayISO()} />
            <Button variant="outline" nativeButton={false} render={<Link href="/cic/validation" />}>
              Review Issues
            </Button>
            {can("cic:prepare") && (
              <Button nativeButton={false} render={<Link href={`/cic/generate?date=${referenceDate}`} />}>
                Generate Report
              </Button>
            )}
          </>
        }
      />
      <DataState
        resource={resource}
        summary="How many members and loans are ready to report to CIC as of the File Reference Date, and what holds the rest back."
        endpoints={["GET /cic/readiness"]}
      >
        {(data) => (
          <ScrollBox className="p-px">
            <ReadinessBody data={data} />
          </ScrollBox>
        )}
      </DataState>
    </PageFill>
  );
}

export default function CicDashboardPage() {
  return (
    <CicGuard permission="cic:view" pageName="CIC Reporting">
      <CicDashboardContent />
    </CicGuard>
  );
}
