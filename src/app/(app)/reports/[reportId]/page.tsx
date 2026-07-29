"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  Play,
  Printer,
  RefreshCw,
  Table as TableIcon,
} from "lucide-react";
import { reportService } from "@/services";
import { REPORT_CATALOG } from "../_lib/report-catalog";
import { CATEGORY_META } from "../_lib/types";
import type { DateRange, ReportDocument, ReportId } from "../_lib/types";
import { exportReportToExcel } from "../_lib/report-excel";
import { exportReportToPdf } from "../_lib/report-pdf";
import { exportReportToDocx } from "../_lib/report-docx";
import { exportReportToCsv } from "../_lib/report-csv";
import { ReportPreview } from "../_components/report-preview";

type BackendExporter = (params?: Record<string, unknown>) => Promise<Blob>;

const BACKEND_CSV_EXPORTERS: Partial<Record<ReportId, BackendExporter>> = {
  releases_list: reportService.exportReleases,
  repayments_list: reportService.exportRepayments,
  due_past_due_list: reportService.exportDuePastDue,
};

type ExportFormat = "excel" | "pdf" | "docx" | "csv" | "print";

const EXPORT_FORMATS: {
  id: ExportFormat;
  label: string;
  hint: string;
  icon: typeof FileSpreadsheet;
}[] = [
  {
    id: "excel",
    label: "Excel (.xlsx)",
    hint: "Best for filtering, totals, accountants",
    icon: FileSpreadsheet,
  },
  {
    id: "pdf",
    label: "PDF (.pdf)",
    hint: "Best for emailing, archiving, signing",
    icon: FileType,
  },
  {
    id: "docx",
    label: "Word (.docx)",
    hint: "Best for editing or pasting into a memo",
    icon: FileText,
  },
  {
    id: "csv",
    label: "CSV (.csv)",
    hint: "Best for raw data, BI tools, scripts",
    icon: TableIcon,
  },
  {
    id: "print",
    label: "Print",
    hint: "Send to printer or save as PDF via the browser",
    icon: Printer,
  },
];

type Preset =
  | "today"
  | "yesterday"
  | "last_7"
  | "this_month"
  | "last_month"
  | "ytd"
  | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 Days" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "ytd", label: "Year to Date" },
  { id: "custom", label: "Custom" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset, fallback: DateRange): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (preset) {
    case "today": {
      const t = isoDate(new Date(y, m, d));
      return { from: t, to: t };
    }
    case "yesterday": {
      const t = isoDate(new Date(y, m, d - 1));
      return { from: t, to: t };
    }
    case "last_7":
      return {
        from: isoDate(new Date(y, m, d - 6)),
        to: isoDate(new Date(y, m, d)),
      };
    case "this_month":
      return {
        from: isoDate(new Date(y, m, 1)),
        to: isoDate(new Date(y, m, d)),
      };
    case "last_month":
      return {
        from: isoDate(new Date(y, m - 1, 1)),
        to: isoDate(new Date(y, m, 0)),
      };
    case "ytd":
      return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, m, d)) };
    case "custom":
    default:
      return fallback;
  }
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.reportId as string | undefined;
  const report = useMemo(
    () => REPORT_CATALOG.find((r) => r.id === (reportId as ReportId)),
    [reportId]
  );

  const [preset, setPreset] = useState<Preset>("this_month");
  const [range, setRange] = useState<DateRange>(() =>
    presetRange("this_month", { from: "", to: "" })
  );
  const [doc, setDoc] = useState<ReportDocument | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const activeRange = preset === "custom" ? range : presetRange(preset, range);

  if (!report) {
    return (
      <RouteGuard permission="reports:view" pageName="Reports">
        <div className="max-w-xl mx-auto py-16 text-center space-y-3">
          <h1 className="text-xl font-semibold">Report not found</h1>
          <p className="text-sm text-muted-foreground">
            The report you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/reports")}
            className="mt-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
        </div>
      </RouteGuard>
    );
  }

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      setRange(presetRange(p, range));
      setDoc(null);
    }
  }

  async function handleGenerate() {
    if (!report) return;
    setGenerating(true);
    try {
      const result = await report.build(activeRange);
      setDoc(result);
    } catch {
      toast.error("We couldn't generate the report. Please try again.");
      setDoc(null);
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport(format: ExportFormat) {
    if (!doc) return;
    setExportingFormat(format);
    try {
      switch (format) {
        case "excel":
          await exportReportToExcel(doc);
          toast.success("Excel file downloaded.");
          break;
        case "pdf":
          exportReportToPdf(doc);
          toast.success("PDF downloaded.");
          break;
        case "docx":
          await exportReportToDocx(doc);
          toast.success("Word document downloaded.");
          break;
        case "csv": {
          const backendExporter = reportId ? BACKEND_CSV_EXPORTERS[reportId as ReportId] : undefined;
          if (backendExporter) {
            const blob = await backendExporter({ date_from: activeRange.from, date_to: activeRange.to });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${reportId}-${activeRange.from}-${activeRange.to}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          } else {
            exportReportToCsv(doc);
          }
          toast.success("CSV downloaded.");
          break;
        }
        case "print":
          window.print();
          break;
      }
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExportingFormat(null);
    }
  }

  const categoryLabel = CATEGORY_META[report.category].label;
  const Icon = report.icon;

  return (
    <RouteGuard permission="reports:view" pageName="Reports">
      <div className="space-y-6">
        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/reports"
            className="hover:text-foreground transition-colors"
          >
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{report.title}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1",
                report.accent.bg,
                report.accent.ring
              )}
            >
              <Icon className={cn("h-6 w-6", report.accent.text)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {categoryLabel}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {report.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {report.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => router.push("/reports")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Reports
            </Button>
            <ExportMenu
              doc={doc}
              exportingFormat={exportingFormat}
              onExport={handleExport}
            />
          </div>
        </div>

        {/* Controls card */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2 min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date Range
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={cn(
                        "h-8 px-3 text-xs rounded-md border transition-colors",
                        preset === p.id
                          ? "bg-brand-orange text-brand-orange-foreground border-brand-orange"
                          : "bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="from-date" className="text-xs">
                    From
                  </Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={activeRange.from}
                    onChange={(e) => {
                      setPreset("custom");
                      setRange({ ...activeRange, from: e.target.value });
                      setDoc(null);
                    }}
                    className="h-9 w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to-date" className="text-xs">
                    To
                  </Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={activeRange.to}
                    onChange={(e) => {
                      setPreset("custom");
                      setRange({ ...activeRange, to: e.target.value });
                      setDoc(null);
                    }}
                    className="h-9 w-40"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="h-9 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : doc ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Generate Preview
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview area */}
        {!doc && !generating && <EmptyPreview reportTitle={report.title} />}
        {generating && (
          <div className="rounded-xl border bg-muted/30 py-24 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Fetching data &amp; building preview…</p>
            </div>
          </div>
        )}
        {doc && !generating && <ReportPreview doc={doc} />}
      </div>
    </RouteGuard>
  );
}

interface ExportMenuProps {
  doc: ReportDocument | null;
  exportingFormat: ExportFormat | null;
  onExport: (format: ExportFormat) => void;
}

function ExportMenu({ doc, exportingFormat, onExport }: ExportMenuProps) {
  const disabled = !doc;
  const exporting = exportingFormat !== null;

  return (
    <div className="inline-flex rounded-md shadow-sm">
      <Button
        onClick={() => onExport("excel")}
        disabled={disabled || exporting}
        className="rounded-r-none bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
      >
        {exportingFormat === "excel" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              disabled={disabled || exporting}
              className="rounded-l-none border-l border-black/10 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark px-2"
              aria-label="Choose another export format"
            />
          }
        >
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Export as…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {EXPORT_FORMATS.map((fmt) => {
              const Icon = fmt.icon;
              return (
                <DropdownMenuItem
                  key={fmt.id}
                  onClick={() => onExport(fmt.id)}
                  disabled={disabled || exporting}
                  className="flex items-start gap-3 py-2"
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{fmt.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {fmt.hint}
                    </p>
                  </div>
                  {exportingFormat === fmt.id && (
                    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EmptyPreview({ reportTitle }: { reportTitle: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 py-16 px-6">
      <div className="max-w-md mx-auto text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-brand-orange/10 flex items-center justify-center">
          <FileSpreadsheet className="h-6 w-6 text-brand-orange" />
        </div>
        <h3 className="text-base font-semibold">
          Ready to generate {reportTitle}
        </h3>
        <p className="text-sm text-muted-foreground">
          Pick a date range above and click{" "}
          <span className="font-medium text-foreground">Generate Preview</span>.
          What you see will match the exported Excel exactly.
        </p>
      </div>
    </div>
  );
}
