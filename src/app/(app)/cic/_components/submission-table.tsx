import type { ReactNode } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CicSubmission } from "@/types/cic";
import { SubmissionStatusBadge, submissionTypeLabel } from "./submission-status-badge";

/** Submissions newest first; `action` adds a last column per row. */
export function SubmissionTable({
  submissions,
  action,
}: {
  submissions: CicSubmission[];
  action?: (s: CicSubmission) => ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Reference Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Generated</TableHead>
          {action && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <Link href={`/cic/submissions/${s.id}`} className="font-mono text-xs underline">
                {s.filename}
              </Link>
            </TableCell>
            <TableCell>{formatDate(s.file_reference_date)}</TableCell>
            <TableCell>{submissionTypeLabel(s.submission_type)}</TableCell>
            <TableCell className="text-right tabular-nums">{s.record_count}</TableCell>
            <TableCell>
              <SubmissionStatusBadge status={s.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTime(s.created_at)}
              {s.created_by ? ` · ${s.created_by}` : ""}
            </TableCell>
            {action && <TableCell className="text-right">{action(s)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
