"use client";

import Link from "next/link";
import { ApplicationStatusBadge, AssessmentBadge } from "@/components/loan-origination/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { isUnsubmitted, maskMobile } from "@/lib/loan-origination";
import type { ApplicationSummary } from "@/types/loan-origination";

/** Application rows, shared by the dashboard's recent list and the Applications tab. */
export function ApplicationsTable({ rows, compact = false }: { rows: ApplicationSummary[]; compact?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Applicant</TableHead>
          {!compact && <TableHead>Mobile</TableHead>}
          <TableHead>Loan product</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          {!compact && <TableHead>Branch</TableHead>}
          <TableHead>Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assessment</TableHead>
          {!compact && <TableHead>Officer</TableHead>}
          {!compact && <TableHead>Last updated</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="whitespace-nowrap font-medium">
              <Link
                href={`/loans/origination/applications/${a.id}`}
                className="rounded-sm text-brand-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
              >
                {a.reference_number ?? `Draft #${a.id}`}
              </Link>
            </TableCell>
            <TableCell className="min-w-36">{a.applicant_name || "—"}</TableCell>
            {/* The server masks it for a role without contact access; masking here too keeps a full number off a shared screen. */}
            {!compact && <TableCell className="whitespace-nowrap font-mono text-xs">{maskMobile(a.mobile)}</TableCell>}
            <TableCell className="min-w-32">{a.loan_product_name ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">
              {a.requested_amount === null ? "—" : formatCurrency(a.requested_amount)}
            </TableCell>
            {!compact && <TableCell>{a.branch_name ?? "—"}</TableCell>}
            <TableCell className="whitespace-nowrap text-sm">
              {a.submitted_at ? formatDate(a.submitted_at) : <span className="text-muted-foreground">Not submitted</span>}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <ApplicationStatusBadge status={a.status} />
              {isUnsubmitted(a.status) && (
                <span className="ml-1 text-xs text-muted-foreground">{a.completion_percent}%</span>
              )}
            </TableCell>
            <TableCell>
              <AssessmentBadge result={a.assessment_result} />
            </TableCell>
            {!compact && <TableCell>{a.assigned_officer_name ?? "—"}</TableCell>}
            {!compact && <TableCell className="whitespace-nowrap text-sm">{formatDate(a.updated_at)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
