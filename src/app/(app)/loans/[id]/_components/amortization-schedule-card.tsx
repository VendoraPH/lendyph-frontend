"use client";

import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateObj } from "@/lib/format";
import type { Loan } from "@/types/loan";
import type { AmortizationRow } from "../_lib/schedule";

interface ScheduleTotals {
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
}

interface AmortizationScheduleCardProps {
  loan: Loan;
  schedule: AmortizationRow[];
  totals: ScheduleTotals;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RELEASED_STATUSES = [
  "released",
  "ongoing",
  "completed",
  "defaulted",
  "restructured",
  "closed",
] as const;

const PREVIEW_STATUSES = ["draft", "for_review", "approved"] as const;

export function AmortizationScheduleCard({
  loan,
  schedule,
  totals,
  open,
  onOpenChange,
}: AmortizationScheduleCardProps) {
  if (schedule.length === 0) return null;

  const isReleased = (RELEASED_STATUSES as readonly string[]).includes(loan.status);
  const isPreview = (PREVIEW_STATUSES as readonly string[]).includes(loan.status);
  const hasScb = totals.shareCapitalBuildUp > 0;

  const scheduleTable = (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            {hasScb && <TableHead className="text-right">Share Capital Build-Up</TableHead>}
            <TableHead className="text-right">Total Payment</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.map((row) => (
            <TableRow key={row.period}>
              <TableCell className="text-center">{row.period}</TableCell>
              <TableCell>{formatDateObj(row.dueDate)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.principal)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.interest)}</TableCell>
              {hasScb && (
                <TableCell className="text-right text-brand-orange">
                  {formatCurrency(row.shareCapitalBuildUp)}
                </TableCell>
              )}
              <TableCell className="text-right font-medium">{formatCurrency(row.totalPayment)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold">Total</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totals.principal)}</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totals.interest)}</TableCell>
            {hasScb && (
              <TableCell className="text-right font-semibold text-brand-orange">
                {formatCurrency(totals.shareCapitalBuildUp)}
              </TableCell>
            )}
            <TableCell className="text-right font-bold">{formatCurrency(totals.totalPayment)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );

  const balancesTable = (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            {hasScb && <TableHead className="text-right">Share Capital Build-Up</TableHead>}
            <TableHead className="text-right">Total Payment</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.map((row) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isPaid = row.status === "paid";
            const isPartial = row.status === "partial";
            const isOverdue =
              row.status === "overdue" ||
              (!isPaid && !isPartial && row.dueDate < today);

            type DisplayStatus = "paid" | "partial" | "overdue" | "upcoming";
            const displayStatus: DisplayStatus = isPaid
              ? "paid"
              : isPartial
                ? "partial"
                : isOverdue
                  ? "overdue"
                  : "upcoming";

            const statusStyles: Record<DisplayStatus, string> = {
              paid: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
              partial: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
              overdue: "border-destructive/40 bg-destructive/10 text-destructive",
              upcoming: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
            };

            return (
              <TableRow
                key={row.period}
                className={cn(isPaid && "text-muted-foreground/50")}
              >
                <TableCell className="text-center">{row.period}</TableCell>
                <TableCell>{formatDateObj(row.dueDate)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {isPaid ? formatCurrency(0) : formatCurrency(row.principal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isPaid ? formatCurrency(0) : formatCurrency(row.interest)}
                </TableCell>
                {hasScb && (
                  <TableCell className="text-right tabular-nums">
                    {isPaid ? formatCurrency(0) : formatCurrency(row.shareCapitalBuildUp)}
                  </TableCell>
                )}
                <TableCell className="text-right font-medium tabular-nums">
                  {isPaid ? formatCurrency(0) : formatCurrency(row.totalPayment)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(row.balance)}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 capitalize",
                      statusStyles[displayStatus],
                    )}
                  >
                    {displayStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => onOpenChange(!open)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Amortization Schedule
            {isPreview && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-yellow-700 dark:text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
              >
                Preview
              </Badge>
            )}
          </CardTitle>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          {!isReleased ? (
            scheduleTable
          ) : (
            <Tabs defaultValue="schedule" className="gap-3">
              <TabsList>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="balances">Balances</TabsTrigger>
              </TabsList>
              <TabsContent value="schedule">{scheduleTable}</TabsContent>
              <TabsContent value="balances">{balancesTable}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      )}
    </Card>
  );
}
