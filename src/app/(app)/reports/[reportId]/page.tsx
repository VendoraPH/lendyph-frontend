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
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { REPORT_CATALOG } from "../_lib/report-catalog";
import { CATEGORY_META } from "../_lib/types";
import type { DateRange, ReportDocument, ReportId } from "../_lib/types";
import { exportReportToExcel } from "../_lib/report-excel";
import { ReportPreview } from "../_components/report-preview";

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
  const [exporting, setExporting] = useState(false);

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
      toast.error("Failed to generate report.");
      setDoc(null);
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport() {
    if (!doc) return;
    setExporting(true);
    try {
      await exportReportToExcel(doc);
      toast.success("Excel file downloaded.");
    } catch {
      toast.error("Failed to export Excel file.");
    } finally {
      setExporting(false);
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
            <Button
              onClick={handleExport}
              disabled={!doc || exporting}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {exporting ? (
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
