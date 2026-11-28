import type { ReactNode } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import type { CicSubmissionRow } from "@/types/cic";
import { whenBy } from "../_lib/labels";
import { SubmissionStatusBadge } from "./submission-status-badge";

/** Submission rows as the server sends them; `action` adds a last column per row (from the row's `actions`). */
export function SubmissionTable({
  submissions,
  action,
}: {
  submissions: CicSubmissionRow[];
  action?: (s: CicSubmissionRow) => ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Reference Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>CIC Reference</TableHead>
          <TableHead>Generated</TableHead>
          {action && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <Link href={`/cic/submissions/${s.id}`} className="font-medium underline">
                {s.reference}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-xs">{s.encrypted_filename ?? s.filename}</TableCell>
            <TableCell>{formatDate(s.reference_date)}</TableCell>
            <TableCell>{s.submission_type_label}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCount(s.record_count)}</TableCell>
            <TableCell>
              <SubmissionStatusBadge status={s.status} label={s.status_label} />
            </TableCell>
            <TableCell className="font-mono text-xs">{s.cic_reference_no ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{whenBy(s.generated_at, s.generated_by, formatDateTime)}</TableCell>
            {action && <TableCell className="text-right">{action(s)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
