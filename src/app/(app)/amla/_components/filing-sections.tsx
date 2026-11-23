"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaCaseApi, readBlobError } from "@/lib/amla/case-api";
import { formatDate, formatDateTime } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import type { AmlaReportDetail, AmlaReportField } from "@/types/amla-cases";

/** The report's fields as the server took them at preparation, in words ("Data not available" where Lendy holds none). */
export function FilingFieldsCard({ fields }: { fields: AmlaReportField[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report fields</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
          {fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="whitespace-pre-wrap">{field.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function downloadProof(reportId: number, submissionId: number, name: string) {
  amlaCaseApi
    .submissionEvidence(reportId, submissionId)
    .then((blob) => saveBlob(blob, name))
    .catch(async (err: unknown) => notifyError(await readBlobError(err), "The evidence couldn't be downloaded."));
}

/** Every filing step recorded by hand, with its portal reference and its proof. */
export function FilingStepsCard({ report }: { report: AmlaReportDetail }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Filing steps</CardTitle>
      </CardHeader>
      <CardContent>
        {report.submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead className="text-right">Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.submissions.map((step) => (
                <TableRow key={step.id}>
                  <TableCell className="whitespace-normal">
                    {step.status_words}
                    {step.note && <div className="text-xs text-muted-foreground">{step.note}</div>}
                  </TableCell>
                  <TableCell>{formatDate(step.date)}</TableCell>
                  <TableCell>{step.reference}</TableCell>
                  <TableCell>
                    {step.by?.name ?? "—"}
                    {step.at && <div className="text-xs text-muted-foreground">{formatDateTime(step.at)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => downloadProof(report.id, step.id, step.evidence_name)}>
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
