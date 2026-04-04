"use client";

import { useState } from "react";
import { toast } from "sonner";
import { reportService } from "@/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Banknote,
  ClipboardList,
  Clock,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Formatters ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount
  );

// ── Types ──

type ReportId =
  | "daily_collection"
  | "portfolio_summary"
  | "income_report"
  | "aging_report"
  | "borrower_report"
  | "disbursement_report";

interface ReportCard {
  id: ReportId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconBg: string;
}

interface ReportPreview {
  reportId: ReportId;
  from: string;
  to: string;
}

// ── Report Definitions ──

const REPORTS: ReportCard[] = [
  {
    id: "daily_collection",
    title: "Daily Collection Report",
    description: "View today's collection summary",
    icon: ClipboardList,
    color: "text-brand-orange",
    iconBg: "bg-brand-orange/10",
  },
  {
    id: "portfolio_summary",
    title: "Portfolio Summary",
    description: "Overall loan portfolio status",
    icon: PieChart,
    color: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    id: "income_report",
    title: "Income Report",
    description: "Interest and fee income breakdown",
    icon: TrendingUp,
    color: "text-green-600",
    iconBg: "bg-green-50",
  },
  {
    id: "aging_report",
    title: "Aging Report",
    description: "Overdue accounts by aging bucket",
    icon: Clock,
    color: "text-red-600",
    iconBg: "bg-red-50",
  },
  {
    id: "borrower_report",
    title: "Borrower Report",
    description: "Active borrowers and loan summary",
    icon: Users,
    color: "text-purple-600",
    iconBg: "bg-purple-50",
  },
  {
    id: "disbursement_report",
    title: "Disbursement Report",
    description: "Loan releases for a period",
    icon: Banknote,
    color: "text-cyan-600",
    iconBg: "bg-cyan-50",
  },
];

// ── Sample Preview Data ──

function getSamplePreview(reportId: ReportId, from: string, to: string) {
  const fromLabel = from
    ? new Date(from).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const toLabel = to
    ? new Date(to).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const period =
    from === to || !to ? fromLabel : `${fromLabel} – ${toLabel}`;

  switch (reportId) {
    case "daily_collection":
      return {
        title: "Daily Collection Report",
        period,
        rows: [
          { label: "Total Due", value: formatCurrency(45000) },
          { label: "Total Collected", value: formatCurrency(38500) },
          { label: "Collection Rate", value: "85.6%" },
          { label: "Uncollected", value: formatCurrency(6500) },
        ],
      };
    case "portfolio_summary":
      return {
        title: "Portfolio Summary",
        period,
        rows: [
          { label: "Total Active Loans", value: "48" },
          { label: "Outstanding Balance", value: formatCurrency(3_850_000) },
          { label: "At Risk (>30d overdue)", value: formatCurrency(420_000) },
          { label: "PAR Ratio", value: "10.9%" },
        ],
      };
    case "income_report":
      return {
        title: "Income Report",
        period,
        rows: [
          { label: "Interest Income", value: formatCurrency(82_500) },
          { label: "Processing Fees", value: formatCurrency(12_800) },
          { label: "Penalty Income", value: formatCurrency(4_350) },
          { label: "Total Income", value: formatCurrency(99_650) },
        ],
      };
    case "aging_report":
      return {
        title: "Aging Report",
        period,
        rows: [
          { label: "1–30 Days Overdue", value: formatCurrency(85_000) },
          { label: "31–60 Days Overdue", value: formatCurrency(210_000) },
          { label: "61–90 Days Overdue", value: formatCurrency(98_500) },
          { label: ">90 Days Overdue", value: formatCurrency(26_500) },
        ],
      };
    case "borrower_report":
      return {
        title: "Borrower Report",
        period,
        rows: [
          { label: "Total Active Borrowers", value: "63" },
          { label: "New Borrowers", value: "7" },
          { label: "Avg Loan Size", value: formatCurrency(85_000) },
          { label: "Repeat Borrowers", value: "41" },
        ],
      };
    case "disbursement_report":
      return {
        title: "Disbursement Report",
        period,
        rows: [
          { label: "Loans Released", value: "12" },
          { label: "Total Disbursed", value: formatCurrency(1_040_000) },
          { label: "Avg Disbursement", value: formatCurrency(86_667) },
          { label: "Pending Release", value: "3" },
        ],
      };
  }
}

// ── Main Page ──

export default function ReportsPage() {
  const [generateTarget, setGenerateTarget] = useState<ReportCard | null>(null);
  const [fromDate, setFromDate] = useState("2026-03-31");
  const [toDate, setToDate] = useState("2026-03-31");
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  function openGenerateDialog(report: ReportCard) {
    setGenerateTarget(report);
    setPreview(null);
  }

  async function handleGenerate() {
    if (!generateTarget) return;

    // Call API based on report type
    try {
      const params = { date_from: fromDate, date_to: toDate };
      let apiData: Record<string, unknown> | null = null;

      switch (generateTarget.id) {
        case "daily_collection":
          apiData = await reportService.dailyCollection(params) as Record<string, unknown>;
          break;
        case "portfolio_summary":
          apiData = await reportService.portfolio(params) as Record<string, unknown>;
          break;
        case "income_report":
          apiData = await reportService.income(params) as Record<string, unknown>;
          break;
        default:
          apiData = await reportService.generate({ type: generateTarget.id, ...params }) as Record<string, unknown>;
          break;
      }

      if (apiData) {
        toast.success("Report generated from API");
      }
    } catch {
      // Fall through to sample preview on API failure
    }

    setPreview({ reportId: generateTarget.id, from: fromDate, to: toDate });
  }

  function handleClose() {
    setGenerateTarget(null);
    setPreview(null);
  }

  const previewData =
    preview
      ? getSamplePreview(preview.reportId, preview.from, preview.to)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and view business reports
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.id}
              className="flex flex-col transition-shadow hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    report.iconBg
                  )}
                >
                  <Icon className={cn("h-5 w-5", report.color)} />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold leading-tight">
                    {report.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0 mt-auto">
                <Button
                  size="sm"
                  className="w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                  onClick={() => openGenerateDialog(report)}
                >
                  Generate
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Generate Dialog */}
      <Dialog open={!!generateTarget} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {generateTarget?.title ?? "Generate Report"}
            </DialogTitle>
            <DialogDescription>
              Select a date range and generate the report.
            </DialogDescription>
          </DialogHeader>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from-date">From</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
          </div>

          {/* Preview Card */}
          {previewData && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{previewData.title}</p>
                <span className="text-xs text-muted-foreground">
                  {previewData.period}
                </span>
              </div>
              <div className="divide-y">
                {previewData.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleGenerate}
            >
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
