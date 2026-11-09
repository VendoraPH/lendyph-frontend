import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOAN_STATUS_COLORS } from "@/constants/loan-status";
import { formatDate } from "@/lib/format";
import type { LoanAgingPage, LoanAgingRow, MemberAgingRow } from "@/types";
import {
  bucketLabel,
  centavosOrDash,
  daysPastDueLabel,
  displayStatusLabel,
  memberLabel,
} from "../_lib/loan-accounting-view";

/** `meta.totals` over every matching row, or null while the answer is for other filters. */
type Totals = LoanAgingPage["meta"]["totals"] | null;

const MONEY_HEADS = (
  <>
    <TableHead className="text-right">Principal Balance</TableHead>
    <TableHead className="text-right">Outstanding</TableHead>
    <TableHead className="text-right">Past Due</TableHead>
  </>
);

function MoneyCells(row: {
  outstanding_principal: number;
  total_outstanding: number;
  past_due_amount: number;
}) {
  return (
    <>
      <TableCell className="text-right font-mono text-sm">
        {centavosOrDash(row.outstanding_principal)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {centavosOrDash(row.total_outstanding)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {centavosOrDash(row.past_due_amount)}
      </TableCell>
    </>
  );
}

function TotalsRow({ totals, span, noun }: { totals: Totals; span: number; noun: string }) {
  return (
    <TableFooter>
      <TableRow>
        <TableCell colSpan={span} className="font-semibold">
          Total{totals ? `, ${totals.count} ${noun}` : ""}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {centavosOrDash(totals?.outstanding_principal)}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {centavosOrDash(totals?.total_outstanding)}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {centavosOrDash(totals?.past_due_amount)}
        </TableCell>
      </TableRow>
    </TableFooter>
  );
}

function statusClass(status: string): string {
  return Object.hasOwn(LOAN_STATUS_COLORS, status)
    ? LOAN_STATUS_COLORS[status as keyof typeof LOAN_STATUS_COLORS]
    : "";
}

export function LoanRowsTable({ rows, totals }: { rows: LoanAgingRow[]; totals: Totals }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Loan</TableHead>
          <TableHead>Member</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Oldest late due date</TableHead>
          <TableHead className="text-right">Days past due</TableHead>
          <TableHead>Bucket</TableHead>
          {MONEY_HEADS}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.loan_id}>
            <TableCell className="font-mono text-sm">
              <Link href={`/loans/${row.loan_id}`} className="text-primary hover:underline">
                {row.account_number}
              </Link>
            </TableCell>
            <TableCell className="text-sm">{memberLabel(row.member)}</TableCell>
            <TableCell className="text-sm">{row.branch?.name ?? "—"}</TableCell>
            <TableCell>
              <Badge variant="outline" className={statusClass(row.display_status)}>
                {displayStatusLabel(row.display_status)}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">
              {row.oldest_late_due_date ? formatDate(row.oldest_late_due_date) : "—"}
            </TableCell>
            <TableCell className="text-right text-sm">
              {daysPastDueLabel(row.days_past_due)}
            </TableCell>
            <TableCell className="text-sm">{bucketLabel(row.bucket)}</TableCell>
            <MoneyCells {...row} />
          </TableRow>
        ))}
      </TableBody>
      <TotalsRow totals={totals} span={7} noun={totals?.count === 1 ? "loan" : "loans"} />
    </Table>
  );
}

export function MemberRowsTable({ rows, totals }: { rows: MemberAgingRow[]; totals: Totals }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead className="text-right">Loans</TableHead>
          <TableHead className="text-right">Days past due (worst loan)</TableHead>
          <TableHead>Bucket (worst loan)</TableHead>
          {MONEY_HEADS}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.member.id}>
            <TableCell className="text-sm">{memberLabel(row.member)}</TableCell>
            <TableCell className="text-right font-mono text-sm">{row.loan_count}</TableCell>
            <TableCell className="text-right text-sm">
              {daysPastDueLabel(row.days_past_due)}
            </TableCell>
            <TableCell className="text-sm">{bucketLabel(row.bucket)}</TableCell>
            <MoneyCells {...row} />
          </TableRow>
        ))}
      </TableBody>
      <TotalsRow totals={totals} span={4} noun={totals?.count === 1 ? "member" : "members"} />
    </Table>
  );
}
