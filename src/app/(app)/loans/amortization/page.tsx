"use client";

import { useState, useMemo } from "react";
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
import { Calculator, CalendarIcon } from "lucide-react";
import {
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
} from "@/constants";
import {
  generateSchedule,
  type AmortizationInput,
  type GeneratedSchedule,
  type InterestMethod,
  type PaymentFrequency,
} from "@/lib/amortization";

// ---------- Formatters ----------

function formatPHP(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------- Status styling infrastructure ----------

type PaymentStatus = "paid" | "partial" | "overdue" | "pending" | "scheduled";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  partial:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "",
  scheduled: "",
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const style = STATUS_STYLES[status];

  if (!style) {
    return <Badge variant="outline">{label}</Badge>;
  }

  return <Badge className={style}>{label}</Badge>;
}

// ---------- Helpers ----------

function toDateInputString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Component ----------

export default function AmortizationPage() {
  // Form state
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [interestMethod, setInterestMethod] =
    useState<InterestMethod>("fixed");
  const [startDate, setStartDate] = useState<string>(
    toDateInputString(new Date())
  );

  // Generated schedules
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [comparison, setComparison] = useState<{
    fixed: GeneratedSchedule;
    diminishing: GeneratedSchedule;
    upon_maturity: GeneratedSchedule;
  } | null>(null);

  const isUponMaturity = interestMethod === "upon_maturity";
  const parsedTerm = parseInt(termMonths) || 0;
  const isUponMaturitySinglePayment = isUponMaturity && parsedTerm <= 1;

  const isFormValid = useMemo(() => {
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const t = parseInt(termMonths);
    return p > 0 && r > 0 && t > 0 && !!startDate;
  }, [principal, interestRate, termMonths, startDate]);

  function buildInput(
    method: InterestMethod,
    freq?: PaymentFrequency
  ): AmortizationInput {
    return {
      principal: parseFloat(principal),
      monthlyRate: parseFloat(interestRate),
      termMonths: parseInt(termMonths),
      frequency: freq ?? frequency,
      interestMethod: method,
      startDate: new Date(startDate),
    };
  }

  function handleGenerate() {
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const t = parseInt(termMonths);
    if (!p || !r || !t) return;

    const uponMaturityFreq = t <= 1 ? "monthly" : frequency;
    const selected = generateSchedule(
      buildInput(interestMethod, isUponMaturity ? uponMaturityFreq : frequency)
    );
    setSchedule(selected);

    // Three-way comparison
    const fixed = generateSchedule(buildInput("fixed", frequency));
    const diminishing = generateSchedule(
      buildInput("diminishing", frequency)
    );
    const upon_maturity = generateSchedule(
      buildInput("upon_maturity", uponMaturityFreq)
    );
    setComparison({ fixed, diminishing, upon_maturity });
  }

  const frequencyLabel =
    PAYMENT_FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label ??
    "Monthly";

  // Totals for footer
  const totals = useMemo(() => {
    if (!schedule) return null;
    return {
      principal: schedule.rows.reduce((s, r) => s + r.principal, 0),
      interest: schedule.rows.reduce((s, r) => s + r.interest, 0),
      totalDue: schedule.rows.reduce((s, r) => s + r.totalDue, 0),
    };
  }, [schedule]);

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
              <Label htmlFor="interestRate">
                Interest Rate (% per month) *
              </Label>
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

            {/* Payment Frequency */}
            <div className="space-y-1.5">
              <Label>Payment Frequency *</Label>
              <Select
                value={frequency}
                onValueChange={(val) =>
                  setFrequency(val as PaymentFrequency)
                }
                disabled={isUponMaturity}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      isUponMaturity
                        ? "Upon Maturity"
                        : value
                          ? (PAYMENT_FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? value)
                          : "Select frequency"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isUponMaturity && (
                <p className="text-xs text-muted-foreground">
                  Single payment at maturity
                </p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date *</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  className="pl-9"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            {/* Interest Method */}
            <div className="space-y-1.5">
              <Label>Interest Method *</Label>
              <RadioGroup
                value={interestMethod}
                onValueChange={(val) =>
                  setInterestMethod(val as InterestMethod)
                }
                className="flex flex-wrap gap-4 pt-1"
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
                {interestMethod === "fixed"
                  ? "Fixed"
                  : interestMethod === "diminishing"
                    ? "Diminishing"
                    : "Upon Maturity"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
                label="Per-period Payment"
                value={
                  interestMethod === "diminishing"
                    ? "Varies"
                    : interestMethod === "upon_maturity"
                      ? schedule.summary.numberOfPayments > 1
                        ? `${formatPHP(schedule.summary.perPeriodPayment ?? 0)} (interest only)`
                        : "Single Payment"
                      : formatPHP(schedule.summary.perPeriodPayment ?? 0)
                }
              />
              <SummaryItem
                label="No. of Payments"
                value={schedule.summary.numberOfPayments.toString()}
              />
              <SummaryItem
                label="Maturity Date"
                value={formatDate(schedule.summary.maturityDate)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 3: Amortization Table */}
      {schedule && totals && (
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
                    <TableHead className="text-right">
                      Beginning Balance
                    </TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Total Due</TableHead>
                    <TableHead className="text-right">
                      Remaining Balance
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.rows.map((row) => {
                    const isLast = row.period === schedule.rows.length;
                    return (
                      <TableRow key={row.period}>
                        <TableCell className="text-center font-medium">
                          {row.period}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.dueDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPHP(row.beginningBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPHP(row.principal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPHP(row.interest)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPHP(row.totalDue)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            isLast ? "text-green-600" : ""
                          }`}
                        >
                          {formatPHP(row.endingBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status="scheduled" />
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
                    <TableCell className="text-right" />
                    <TableCell className="text-right font-semibold">
                      {formatPHP(totals.principal)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPHP(totals.interest)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPHP(totals.totalDue)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatPHP(0)}
                    </TableCell>
                    <TableCell />
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
              <Badge variant="outline">
                Fixed vs Diminishing vs Upon Maturity
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MethodComparison comparison={comparison} frequency={frequencyLabel} />
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

function MethodComparison({
  comparison,
  frequency,
}: {
  comparison: {
    fixed: GeneratedSchedule;
    diminishing: GeneratedSchedule;
    upon_maturity: GeneratedSchedule;
  };
  frequency: string;
}) {
  const methods = [
    {
      key: "fixed" as const,
      label: "Fixed / Straight",
      data: comparison.fixed,
    },
    {
      key: "diminishing" as const,
      label: "Diminishing Balance",
      data: comparison.diminishing,
    },
    {
      key: "upon_maturity" as const,
      label: "Upon Maturity",
      data: comparison.upon_maturity,
    },
  ];

  // Find method with lowest total interest
  const lowestInterest = Math.min(
    ...methods.map((m) => m.data.summary.totalInterest)
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {methods.map((method) => {
          const s = method.data.summary;
          const isLowest = s.totalInterest === lowestInterest;

          return (
            <div
              key={method.key}
              className={`rounded-lg border p-4 space-y-3 ${
                isLowest
                  ? "border-green-500 ring-1 ring-green-500/20"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{method.label}</h3>
                {isLowest && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Lowest Interest
                  </Badge>
                )}
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <ComparisonRow
                  label="Total Interest"
                  value={formatPHP(s.totalInterest)}
                />
                <ComparisonRow
                  label="Total Payable"
                  value={formatPHP(s.totalPayable)}
                />
                <ComparisonRow
                  label="Payment"
                  value={
                    method.key === "diminishing"
                      ? `${formatPHP(s.firstPayment)} - ${formatPHP(s.lastPayment)}`
                      : method.key === "upon_maturity"
                        ? s.numberOfPayments > 1
                          ? `${formatPHP(s.firstPayment)} interest + principal at end`
                          : `${formatPHP(s.totalPayable)} (single)`
                        : formatPHP(s.perPeriodPayment ?? 0)
                  }
                />
                <ComparisonRow
                  label="No. of Payments"
                  value={s.numberOfPayments.toString()}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
