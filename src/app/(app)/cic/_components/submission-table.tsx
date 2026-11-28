import type { ReactNode } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import type { CicSubmissionRow } from "@/types/cic";
import { staffName } from "../_lib/labels";
import { SubmissionStatusBadge } from "./submission-status-badge";

/**
 * Submission rows as the server sends them; `action` adds a last column per
 * row (from the row's `actions`). Long values wrap, so the table fits at
 * 1366 px and the row's action stays in view without a sideways scroll.
 */
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
          <TableHead>File</TableHead>
          <TableHead className="whitespace-normal">Reference Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="whitespace-normal">CIC Reference</TableHead>
          <TableHead>Generated</TableHead>
          {action && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="max-w-64 whitespace-normal">
              <Link href={`/cic/submissions/${s.id}`} className="font-medium underline">
                {s.reference}
              </Link>
              <span className="block break-all font-mono text-xs text-muted-foreground">
                {s.encrypted_filename ?? s.filename}
              </span>
            </TableCell>
            <TableCell>{formatDate(s.reference_date)}</TableCell>
            <TableCell className="max-w-32 whitespace-normal">{s.submission_type_label}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCount(s.record_count)}</TableCell>
            <TableCell>
              <SubmissionStatusBadge status={s.status} label={s.status_label} />
            </TableCell>
            <TableCell className="max-w-36 break-all whitespace-normal font-mono text-xs">{s.cic_reference_no ?? "—"}</TableCell>
            <TableCell className="whitespace-normal text-muted-foreground">
              {formatDateTime(s.generated_at)}
              {s.generated_by && <span className="block text-xs">by {staffName(s.generated_by)}</span>}
            </TableCell>
            {action && <TableCell className="text-right">{action(s)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
