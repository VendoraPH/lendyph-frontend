"use client";

import { Fragment, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ChevronDown, ChevronRight, UserCheck } from "lucide-react";
import type { CoMaker, Loan, LoanSchedule } from "@/types";
import { LOAN_STATUS_LABELS, PAYMENT_FREQUENCY_LABELS } from "@/constants";
import { MOCK_SCHEDULES } from "./mock-detail-data";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const loanStatusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-800",
  ongoing: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  completed: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  defaulted: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  restructured: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800",
  rejected: "bg-red-100 text-red-500 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
};

const scheduleStatusColor: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};

interface LoansTabProps {
  loans: Loan[];
  coMakers: CoMaker[];
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

export function LoansTab({ loans, coMakers }: LoansTabProps) {
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
                <TableHead>Co-Maker</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLoans.map((loan) => {
                const schedule = MOCK_SCHEDULES[loan.id] ?? [];
                const hasSchedule = schedule.length > 0;
                const isExpanded = expandedLoan === loan.id;

                const loanCoMakers = coMakers.filter((cm) => cm.loan_id === loan.id);
                const hasCoMaker = loanCoMakers.length > 0;
                const needsCoMaker = !hasCoMaker && loan.principal_amount >= 50000 && loan.status !== "completed";
                const isExpandable = hasSchedule || loanCoMakers.length > 0 || needsCoMaker;

                return (
                  <Fragment key={loan.id}>
                    <TableRow
                      className={isExpandable ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => {
                        if (isExpandable) {
                          setExpandedLoan(isExpanded ? null : loan.id);
                        }
                      }}
                    >
                      <TableCell>
                        {isExpandable &&
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
                      <TableCell>
                        {hasCoMaker ? (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-600">{loanCoMakers.length}</span>
                          </div>
                        ) : needsCoMaker ? (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-xs text-amber-500">Recommended</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${loan.id}-details`}>
                        <TableCell colSpan={10} className="p-0">
                          {/* Co-maker info */}
                          {loanCoMakers.length > 0 && (
                            <div className="mx-4 mt-4 mb-2 rounded-lg border bg-green-50/50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                Co-Maker{loanCoMakers.length > 1 ? "s" : ""} for this Loan
                              </p>
                              <div className="grid gap-2 md:grid-cols-2">
                                {loanCoMakers.map((cm) => (
                                  <div key={cm.id} className="flex items-center gap-3 rounded-md border bg-card p-2">
                                    <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{cm.full_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {cm.relationship} · {cm.phone}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Repayment schedule */}
                          {hasSchedule && <ScheduleTable schedule={schedule} />}
                          {/* Warning if no co-maker needed */}
                          {needsCoMaker && (
                            <div className="mx-4 mt-2 mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                              <p className="text-xs text-amber-600">
                                This loan is ≥ ₱50,000. A co-maker is recommended for high-value loans.
                              </p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
