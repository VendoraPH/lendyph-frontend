"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Loan, LoanSchedule } from "@/types";
import { LOAN_STATUS_LABELS, PAYMENT_FREQUENCY_LABELS } from "@/constants";
import { MOCK_SCHEDULES } from "./mock-detail-data";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const loanStatusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200",
  ongoing: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  defaulted: "bg-red-100 text-red-700 border-red-200",
  restructured: "bg-orange-100 text-orange-700 border-orange-200",
  rejected: "bg-red-100 text-red-500 border-red-200",
};

const scheduleStatusColor: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};

interface LoansTabProps {
  loans: Loan[];
}

function ScheduleTable({ schedule }: { schedule: LoanSchedule[] }) {
  return (
    <div className="rounded-lg border bg-muted/30 mx-4 mb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Due Date</TableHead>
            <TableHead className="text-xs text-right">Principal</TableHead>
            <TableHead className="text-xs text-right">Interest</TableHead>
            <TableHead className="text-xs text-right">Amount Due</TableHead>
            <TableHead className="text-xs text-right">Paid</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-sm">{formatDate(s.due_date)}</TableCell>
              <TableCell className="text-sm text-right tabular-nums">{formatCurrency(s.principal)}</TableCell>
              <TableCell className="text-sm text-right tabular-nums">{formatCurrency(s.interest)}</TableCell>
              <TableCell className="text-sm text-right tabular-nums font-medium">{formatCurrency(s.amount_due)}</TableCell>
              <TableCell className="text-sm text-right tabular-nums">{formatCurrency(s.amount_paid)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={scheduleStatusColor[s.status]}>{s.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function LoansTab({ loans }: LoansTabProps) {
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);

  const sortedLoans = [...loans].sort((a, b) => {
    const order: Record<string, number> = {
      ongoing: 0, defaulted: 1, pending: 2, approved: 3, released: 4, restructured: 5, completed: 6, rejected: 7,
    };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Released</TableHead>
                <TableHead>Maturity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLoans.map((loan) => {
                const schedule = MOCK_SCHEDULES[loan.id] ?? [];
                const hasSchedule = schedule.length > 0;
                const isExpanded = expandedLoan === loan.id;

                return (
                  <>
                    <TableRow
                      key={loan.id}
                      className={hasSchedule ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => {
                        if (hasSchedule) {
                          setExpandedLoan(isExpanded ? null : loan.id);
                        }
                      }}
                    >
                      <TableCell>
                        {hasSchedule &&
                          (isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                      <TableCell className="font-medium">{loan.purpose || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(loan.principal_amount)}</TableCell>
                      <TableCell>{loan.interest_rate}%</TableCell>
                      <TableCell>
                        {loan.term_months}mo · {PAYMENT_FREQUENCY_LABELS[loan.payment_frequency] ?? loan.payment_frequency}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-brand-orange">
                        {loan.outstanding_balance > 0 ? formatCurrency(loan.outstanding_balance) : "Paid"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {loan.released_at ? formatDate(loan.released_at) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {loan.maturity_date ? formatDate(loan.maturity_date) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={loanStatusColor[loan.status]}>
                          {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasSchedule && (
                      <TableRow key={`${loan.id}-schedule`}>
                        <TableCell colSpan={9} className="p-0">
                          <ScheduleTable schedule={schedule} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No loans found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
