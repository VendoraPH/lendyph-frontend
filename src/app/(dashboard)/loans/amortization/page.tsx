"use client";

import { useState, useMemo } from "react";
import { format, addDays, addMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Calculator,
  CalendarIcon,
  ArrowRight,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
} from "@/constants";

// ---------- Types ----------

type InterestType = "fixed" | "diminishing";
type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "monthly";

interface ScheduleRow {
  period: number;
  dueDate: Date;
  principal: number;
  interest: number;
  totalPayment: number;
  runningBalance: number;
}

interface ScheduleSummary {
  totalPrincipal: number;
  totalInterest: number;
  totalPayable: number;
  perPeriodPayment: number | null; // null for diminishing (varies)
  numberOfPayments: number;
  firstPayment?: number;
  lastPayment?: number;
}

interface GeneratedSchedule {
  rows: ScheduleRow[];
  summary: ScheduleSummary;
}

// ---------- Computation helpers ----------

function getPeriodsFromFrequency(
  termMonths: number,
  frequency: PaymentFrequency
): number {
  switch (frequency) {
    case "monthly":
      return termMonths;
    case "bi_weekly":
      return termMonths * 2;
    case "weekly":
      return termMonths * 4;
    case "daily":
      return termMonths * 30;
  }
}

function getNextDueDate(
  startDate: Date,
  periodIndex: number,
  frequency: PaymentFrequency
): Date {
  switch (frequency) {
    case "monthly":
      return addMonths(startDate, periodIndex);
    case "bi_weekly":
      return addDays(startDate, periodIndex * 14);
    case "weekly":
      return addDays(startDate, periodIndex * 7);
    case "daily":
      return addDays(startDate, periodIndex);
  }
}

function generateSchedule(
  principal: number,
  rate: number,
  termMonths: number,
  frequency: PaymentFrequency,
  interestType: InterestType,
  startDate: Date
): GeneratedSchedule {
  const periods = getPeriodsFromFrequency(termMonths, frequency);
  const principalPerPeriod = principal / periods;
  const rows: ScheduleRow[] = [];
  let remaining = principal;
  let totalInterest = 0;

  for (let i = 1; i <= periods; i++) {
    const dueDate = getNextDueDate(startDate, i, frequency);
    const interest =
      interestType === "fixed"
        ? principal * (rate / 100)
        : remaining * (rate / 100);

    const isLastPeriod = i === periods;
    const principalPortion = isLastPeriod ? remaining : principalPerPeriod;
    const totalPayment = principalPortion + interest;

    remaining = isLastPeriod ? 0 : remaining - principalPerPeriod;
    totalInterest += interest;

    rows.push({
      period: i,
      dueDate,
      principal: principalPortion,
      interest,
      totalPayment,
      runningBalance: remaining,
    });
  }

  const totalPayable = principal + totalInterest;
  const isFixed = interestType === "fixed";

  return {
    rows,
    summary: {
      totalPrincipal: principal,
      totalInterest,
      totalPayable,
      perPeriodPayment: isFixed ? rows[0]?.totalPayment ?? 0 : null,
      numberOfPayments: periods,
      firstPayment: rows[0]?.totalPayment,
      lastPayment: rows[rows.length - 1]?.totalPayment,
    },
  };
}

// ---------- Currency formatter ----------

function formatPHP(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ---------- Component ----------

export default function AmortizationPage() {
  // Form state
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [interestType, setInterestType] = useState<InterestType>("fixed");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Generated schedule
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [comparison, setComparison] = useState<{
    fixed: GeneratedSchedule;
    diminishing: GeneratedSchedule;
  } | null>(null);

  const isFormValid = useMemo(() => {
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const t = parseInt(termMonths);
    return p > 0 && r > 0 && t > 0 && startDate instanceof Date;
  }, [principal, interestRate, termMonths, startDate]);

  function handleGenerate() {
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const t = parseInt(termMonths);
    if (!p || !r || !t) return;

    const selected = generateSchedule(p, r, t, frequency, interestType, startDate);
    setSchedule(selected);

    // Generate comparison for both methods
    const fixed = generateSchedule(p, r, t, frequency, "fixed", startDate);
    const diminishing = generateSchedule(p, r, t, frequency, "diminishing", startDate);
    setComparison({ fixed, diminishing });
  }

  const frequencyLabel =
    PAYMENT_FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Amortization Schedule
        </h1>
        <p className="text-muted-foreground">
          Generate and preview loan repayment schedules
        </p>
      </div>

      {/* Card 1: Loan Parameters */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Calculator className="h-5 w-5 text-brand-orange" />
          <CardTitle>Loan Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Principal */}
            <div className="space-y-1.5">
              <Label htmlFor="principal">Principal Amount (PHP) *</Label>
              <Input
                id="principal"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 50000"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>

            {/* Interest Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="interestRate">Interest Rate (% per month) *</Label>
              <Input
                id="interestRate"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 3"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>

            {/* Term */}
            <div className="space-y-1.5">
              <Label htmlFor="termMonths">Term (months) *</Label>
              <Input
                id="termMonths"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 12"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
              />
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label>Payment Frequency *</Label>
              <Select
                value={frequency}
                onValueChange={(val) => setFrequency(val as PaymentFrequency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setCalendarOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Interest Method */}
            <div className="space-y-1.5">
              <Label>Interest Method *</Label>
              <RadioGroup
                value={interestType}
                onValueChange={(val) => setInterestType(val as InterestType)}
                className="flex gap-4 pt-1"
              >
                {INTEREST_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <RadioGroupItem value={opt.value} />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          <div className="mt-5">
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              disabled={!isFormValid}
              onClick={handleGenerate}
            >
              <Calculator className="mr-1.5 h-4 w-4" />
              Generate Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Schedule Summary */}
      {schedule && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Schedule Summary
              <Badge className="bg-brand-orange text-brand-orange-foreground">
                {interestType === "fixed" ? "Fixed" : "Diminishing"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryItem
                label="Total Principal"
                value={formatPHP(schedule.summary.totalPrincipal)}
              />
              <SummaryItem
                label="Total Interest"
                value={formatPHP(schedule.summary.totalInterest)}
              />
              <SummaryItem
                label="Total Payable"
                value={formatPHP(schedule.summary.totalPayable)}
                highlight
              />
              <SummaryItem
                label={`${frequencyLabel} Payment`}
                value={
                  schedule.summary.perPeriodPayment !== null
                    ? formatPHP(schedule.summary.perPeriodPayment)
                    : "Varies"
                }
              />
              <SummaryItem
                label="No. of Payments"
                value={schedule.summary.numberOfPayments.toString()}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 3: Amortization Table */}
      {schedule && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Amortization Table</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Total Payment</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.rows.map((row) => {
                    const isLast =
                      row.period === schedule.rows.length;
                    return (
                      <TableRow key={row.period}>
                        <TableCell className="text-center font-medium">
                          {row.period}
                        </TableCell>
                        <TableCell>
                          {format(row.dueDate, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPHP(row.principal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPHP(row.interest)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPHP(row.totalPayment)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            isLast ? "text-green-600" : ""
                          }`}
                        >
                          {formatPHP(row.runningBalance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      Totals
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPHP(schedule.summary.totalPrincipal)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPHP(schedule.summary.totalInterest)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPHP(schedule.summary.totalPayable)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatPHP(0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 4: Method Comparison */}
      {comparison && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Method Comparison
              <Badge variant="outline">Fixed vs Diminishing</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Fixed */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Fixed / Straight</h3>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <ComparisonRow
                    label="Total Interest"
                    value={formatPHP(comparison.fixed.summary.totalInterest)}
                  />
                  <ComparisonRow
                    label="Total Payable"
                    value={formatPHP(comparison.fixed.summary.totalPayable)}
                  />
                  <ComparisonRow
                    label="Constant Payment"
                    value={formatPHP(
                      comparison.fixed.summary.perPeriodPayment ?? 0
                    )}
                  />
                </div>
              </div>

              {/* Diminishing */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-brand-orange" />
                  <h3 className="font-semibold text-sm">Diminishing Balance</h3>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <ComparisonRow
                    label="Total Interest"
                    value={formatPHP(
                      comparison.diminishing.summary.totalInterest
                    )}
                  />
                  <ComparisonRow
                    label="Total Payable"
                    value={formatPHP(
                      comparison.diminishing.summary.totalPayable
                    )}
                  />
                  <ComparisonRow
                    label="First Payment"
                    value={formatPHP(
                      comparison.diminishing.summary.firstPayment ?? 0
                    )}
                  />
                  <ComparisonRow
                    label="Last Payment"
                    value={formatPHP(
                      comparison.diminishing.summary.lastPayment ?? 0
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Savings */}
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  Interest Savings with Diminishing Balance
                </div>
                <span className="text-lg font-bold text-green-600">
                  {formatPHP(
                    comparison.fixed.summary.totalInterest -
                      comparison.diminishing.summary.totalInterest
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${
          highlight ? "text-brand-orange" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ComparisonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
