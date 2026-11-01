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
import { Calculator, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  INTEREST_METHOD_LABELS,
  INTEREST_RATE_FREQUENCY_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  TERM_UNIT_OPTIONS,
} from "@/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api-error";
import { loanService } from "@/services/loan.service";
import type {
  AmortizationCalculatorResult,
  AmortizationCalculatorSchedule,
  AmortizationMethod,
} from "@/types";

// ---------- Helpers ----------

const METHODS: AmortizationMethod[] = ["straight", "diminishing", "upon_maturity"];

function toDateInputString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function optionLabel(options: readonly { value: string; label: string }[], value: string | null): string {
  return value ? (options.find((o) => o.value === value)?.label ?? value) : "Select";
}

/**
 * The per-period payment as the server scheduled it: one figure when every
 * period's payment is the same, otherwise the first and last. A comparison of
 * server figures; nothing is added up.
 */
function paymentLabel(schedule: AmortizationCalculatorSchedule): string {
  const rows = schedule.rows;
  if (rows.length === 0) return "—";
  if (rows.length === 1) return `${formatCurrency(rows[0].total_payment)} (single)`;
  const first = rows[0].total_payment;
  const last = rows[rows.length - 1].total_payment;
  const uniform = rows.every((r) => r.total_payment === first);
  return uniform ? formatCurrency(first) : `${formatCurrency(first)} – ${formatCurrency(last)}`;
}

// ---------- Component ----------

/**
 * Every figure on this page comes from POST /loans/amortization-calculator,
 * built by the code that writes a real loan's schedule. The page only collects
 * the inputs and displays the answer.
 */
export default function AmortizationPage() {
  // Form state
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [rateFrequency, setRateFrequency] = useState("monthly");
  const [term, setTerm] = useState("");
  const [termUnit, setTermUnit] = useState("months");
  const [frequency, setFrequency] = useState("monthly");
  const [interestMethod, setInterestMethod] = useState<AmortizationMethod>("straight");
  const [scbAmount, setScbAmount] = useState("");
  const [startDate, setStartDate] = useState<string>(toDateInputString(new Date()));

  const [result, setResult] = useState<AmortizationCalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const isFormValid = useMemo(() => {
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const t = parseInt(term);
    return p > 0 && r > 0 && t > 0 && !!startDate;
  }, [principal, interestRate, term, startDate]);

  function handleGenerate() {
    if (!isFormValid) return;
    setCalculating(true);
    const scb = parseFloat(scbAmount);
    loanService
      .amortizationCalculator({
        principal_amount: parseFloat(principal),
        interest_rate: parseFloat(interestRate),
        interest_rate_frequency: rateFrequency,
        interest_method: interestMethod,
        term: parseInt(term),
        term_unit: termUnit,
        frequency,
        start_date: startDate,
        ...(scb > 0 ? { scb_amount: scb } : {}),
        compare: true,
      })
      .then((res) => setResult(res))
      .catch((err) => {
        setResult(null);
        toast.error(getErrorMessage(err, "We couldn't build the schedule. Please check the inputs and try again."));
      })
      .finally(() => setCalculating(false));
  }

  const hasScb = (result?.totals.share_capital_build_up ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Amortization Calculator
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
              <Label htmlFor="interestRate">Interest Rate (%) *</Label>
              <Input
                id="interestRate"
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 3"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>

            {/* Rate Frequency */}
            <div className="space-y-1.5">
              <Label>Rate Per *</Label>
              <Select value={rateFrequency} onValueChange={(val) => setRateFrequency(String(val))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => optionLabel(INTEREST_RATE_FREQUENCY_OPTIONS, value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_RATE_FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Term */}
            <div className="space-y-1.5">
              <Label htmlFor="term">Term *</Label>
              <Input
                id="term"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 12"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>

            {/* Term Unit */}
            <div className="space-y-1.5">
              <Label>Term Unit *</Label>
              <Select value={termUnit} onValueChange={(val) => setTermUnit(String(val))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => optionLabel(TERM_UNIT_OPTIONS, value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TERM_UNIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Frequency */}
            <div className="space-y-1.5">
              <Label>Payment Frequency *</Label>
              <Select value={frequency} onValueChange={(val) => setFrequency(String(val))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => optionLabel(PAYMENT_FREQUENCY_OPTIONS, value)}
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
              {frequency === "upon_maturity" && (
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

            {/* Share Capital Build-Up */}
            <div className="space-y-1.5">
              <Label htmlFor="scbAmount">Share Capital Build-Up per Period (PHP)</Label>
              <Input
                id="scbAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={scbAmount}
                onChange={(e) => setScbAmount(e.target.value)}
              />
            </div>

            {/* Interest Method */}
            <div className="space-y-1.5">
              <Label>Interest Method *</Label>
              <RadioGroup
                value={interestMethod}
                onValueChange={(val) => setInterestMethod(val as AmortizationMethod)}
                className="flex flex-wrap gap-4 pt-1"
              >
                {METHODS.map((method) => (
                  <label
                    key={method}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <RadioGroupItem value={method} />
                    {INTEREST_METHOD_LABELS[method]}
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          <div className="mt-5">
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              disabled={!isFormValid || calculating}
              onClick={handleGenerate}
            >
              {calculating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-1.5 h-4 w-4" />
              )}
              Generate Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Schedule Summary */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Schedule Summary
              <Badge className="bg-brand-orange text-brand-orange-foreground">
                {INTEREST_METHOD_LABELS[result.interest_method] ?? result.interest_method}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <SummaryItem label="Total Principal" value={formatCurrency(result.totals.principal_due)} />
              <SummaryItem label="Total Interest" value={formatCurrency(result.totals.interest_due)} />
              <SummaryItem label="Total Payable" value={formatCurrency(result.totals.total_payment)} highlight />
              <SummaryItem label="Per-period Payment" value={paymentLabel(result)} />
              <SummaryItem label="No. of Payments" value={result.rows.length.toString()} />
              <SummaryItem label="Maturity Date" value={formatDate(result.maturity_date)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 3: Amortization Table */}
      {result && (
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
                    {hasScb && <TableHead className="text-right">Share Capital</TableHead>}
                    <TableHead className="text-right">Total Payment</TableHead>
                    <TableHead className="text-right">Remaining Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.period_number}>
                      <TableCell className="text-center font-medium">{row.period_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(row.due_date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.principal_due)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.interest_due)}</TableCell>
                      {hasScb && (
                        <TableCell className="text-right">{formatCurrency(row.share_capital_build_up)}</TableCell>
                      )}
                      <TableCell className="text-right font-medium">{formatCurrency(row.total_payment)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.remaining_balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(result.totals.principal_due)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(result.totals.interest_due)}</TableCell>
                    {hasScb && (
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(result.totals.share_capital_build_up)}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-semibold">{formatCurrency(result.totals.total_payment)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 4: Method Comparison */}
      {result?.comparison && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Method Comparison
              <Badge variant="outline">
                Straight vs Diminishing vs Upon Maturity
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MethodComparison comparison={result.comparison} />
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
}: {
  comparison: Record<AmortizationMethod, AmortizationCalculatorSchedule>;
}) {
  // Which server total is lowest: a comparison of the server's figures.
  const lowestInterest = Math.min(...METHODS.map((m) => comparison[m].totals.interest_due));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {METHODS.map((method) => {
        const schedule = comparison[method];
        const isLowest = schedule.totals.interest_due === lowestInterest;

        return (
          <div
            key={method}
            className={`rounded-lg border p-4 space-y-3 ${
              isLowest ? "border-green-500 ring-1 ring-green-500/20" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{INTEREST_METHOD_LABELS[method]}</h3>
              {isLowest && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Lowest Interest
                </Badge>
              )}
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <ComparisonRow label="Total Interest" value={formatCurrency(schedule.totals.interest_due)} />
              <ComparisonRow label="Total Payable" value={formatCurrency(schedule.totals.total_payment)} />
              <ComparisonRow label="Payment" value={paymentLabel(schedule)} />
              <ComparisonRow label="No. of Payments" value={schedule.rows.length.toString()} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
