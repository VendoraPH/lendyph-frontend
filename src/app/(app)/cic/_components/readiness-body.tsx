import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermission } from "@/hooks";
import { formatCount } from "@/lib/report-format";
import type { CicDataRecordType, CicReadiness, CicRecordCounts } from "@/types/cic";
import { recordTypeLabel } from "../_lib/labels";
import { IssueTable } from "./issue-table";
import { SeverityBadge } from "./severity-badge";

const TYPES: CicDataRecordType[] = ["ID", "CI", "CN", "NE"];

function CountCard({ type, count }: { type: CicDataRecordType; count: CicRecordCounts }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{recordTypeLabel(type)}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCount(count.ready)}{" "}
          <span className="text-base font-normal text-muted-foreground">of {formatCount(count.records)} ready</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {count.records === 0
            ? "None to report."
            : `${formatCount(count.with_errors)} with errors · ${formatCount(count.with_warnings)} with warnings`}
        </p>
      </CardContent>
    </Card>
  );
}

/** The server's live readiness: counts per record type, what holds records back, unmapped products. */
export function ReadinessBody({ data }: { data: CicReadiness }) {
  const { can } = usePermission();
  return (
    <div className="space-y-6">
      {data.blocking ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Errors block a file</AlertTitle>
          <AlertDescription>
            CIC rejects a file with any error. Fix them in Lendy; the month-end capture freezes what it finds.
          </AlertDescription>
        </Alert>
      ) : null}
      {data.unmapped_products.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Loan products without a CIC mapping</AlertTitle>
          <AlertDescription>
            {data.unmapped_products.map((p) => `${p.name} (${p.contracts} ${p.contracts === 1 ? "loan" : "loans"})`).join(", ")}.
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TYPES.map((t) => (
          <CountCard key={t} type={t} count={data.record_types[t]} />
        ))}
      </div>

      {data.file_issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">File Problems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <IssueTable issues={data.file_issues} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What Holds Records Back</CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No missing or invalid fields.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_issues.map((i) => (
                    <TableRow key={`${i.record_type}-${i.field_id}-${i.code}`}>
                      <TableCell>
                        <SeverityBadge severity={i.severity} />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="font-mono text-xs">{i.field_id}</span> {i.field_name}
                        <span className="block text-xs text-muted-foreground">{recordTypeLabel(i.record_type)}</span>
                      </TableCell>
                      <TableCell className="whitespace-normal">{i.message}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(i.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
