"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
// Deep import, not the barrel: re-exporting this one costs every page that
// imports `@/components/common` ~52 kB it cannot use. See the note in the barrel.
import { SubjectPicker } from "@/components/common/subject-picker";
import {
  ACCOUNT_REPORT_HINT,
  noDateRangeScope,
  linkedBranchId,
  presetAccountId,
  presetBranchId,
  presetMemberId,
  presetPeriodRange,
  reportPickPrompt,
  reportSubjectNoun,
} from "../_lib/report-subject";
import { toMemberOption, type MemberOption } from "@/hooks/use-member-search";
import { useAuth, useBranches } from "@/hooks";
import { useBrandingStore } from "@/store/branding-store";
import { branchPicker, pickedBranchLabel } from "@/lib/user-branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { todayISO } from "@/lib/format";
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
import { borrowerService, reportService } from "@/services";
import { visibleReports } from "../_lib/report-catalog";
import { csvFileName } from "../_lib/export-file-name";
import { PRESETS, presetRange, type Preset } from "../_lib/report-period";
import { CATEGORY_META, MAX_REPORT_SPAN_YEARS, exceedsReportSpanCap } from "../_lib/types";
import type { DateRange, ReportDocument, ReportId } from "../_lib/types";
import { ReportPreview } from "../_components/report-preview";
import { ReportPrintSheet } from "../_components/report-print-sheet";
import { applyChrome, loadLogoDataUrl } from "../_lib/report-chrome";
import { reportScopeParams } from "../_lib/report-catalog";
import { savingsCsvReport } from "../_lib/savings-csv";
import { ProductFilter } from "../../savings/_components/product-filter";
import { OptionSelect } from "../../savings/_components/option-select";
import { ALL_PRODUCTS, productIdParam } from "../../savings/_lib/product-filter";
import { ExpandableCard } from "@/components/common/expandable-card";
import { hasIllustration, Illustration } from "@/components/common/illustration";
import { PageFill } from "@/components/common/page-fill";

type BackendExporter = (params?: Record<string, unknown>) => Promise<Blob>;

const BACKEND_CSV_EXPORTERS: Partial<Record<ReportId, BackendExporter>> = {
  releases_list: reportService.exportReleases,
  repayments_list: reportService.exportRepayments,
  due_past_due_list: reportService.exportDuePastDue,
};

/** The server's CSV for a report: a loan list's export, or the savings report's own. */
function backendCsvExporter(id: ReportId, subjectId: number | null): BackendExporter | undefined {
  const savings = savingsCsvReport(id, subjectId);
  return savings
    ? (params) => reportService.exportSavingsReport(savings, params)
    : BACKEND_CSV_EXPORTERS[id];
}

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

/** Sentinel for "no branch filter" — Select needs a string, not null. */
const ALL_BRANCHES = "all";
/** What an unfiltered report is labelled for a caller with `branches:view_all`. */
const ALL_BRANCHES_LABEL = "All Branches";

function ReportDetailContent({
  memberParam,
  accountParam,
  periodParam,
  branchParam,
}: {
  memberParam: number | null;
  accountParam: number | null;
  /** `?from=&to=`, already checked: both real dates, in order. */
  periodParam: DateRange | null;
  branchParam: number | null;
}) {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.reportId as string | undefined;
  const { user, hasPermission } = useAuth();
  // A report this deployment or user can't open answers "not found", the
  // same as an unknown id, so its data is never requested.
  const report = visibleReports(hasPermission).find((r) => r.id === (reportId as ReportId));

  // A link's `?from=&to=` opens the report on that period, as a custom range,
  // on reports that have date controls. It only presets them; nothing runs
  // until Generate.
  const linkedPeriod = report?.noDateRange ? null : periodParam;
  const defaultPreset: Preset = linkedPeriod ? "custom" : (report?.defaultPeriod ?? "this_month");
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [range, setRange] = useState<DateRange>(() =>
    linkedPeriod ?? presetRange(defaultPreset, { from: "", to: "" })
  );
  // A link's `?branch=<id>` presets the picker on reports that filter by
  // branch. It counts only once the picker offers it (see `pickedBranchId`).
  const [branchChoice, setBranchChoice] = useState<number | null>(
    report?.supportsBranch ? branchParam : null
  );
  // The savings product filter, and its words for the report's subtitle.
  const [product, setProduct] = useState<{ value: string; label: string }>({ value: ALL_PRODUCTS, label: "" });
  const [groupBy, setGroupBy] = useState<string | null>(report?.groupBy?.options[0]?.value ?? null);
  // `?member=<id>` opens a member's report with them selected. Reading a member
  // needs `borrowers:view`, the same as the picker; without it nothing is preset.
  const presetId =
    report?.subject === "borrower" && hasPermission("borrowers:view") ? memberParam : null;
  const [subjectId, setSubjectId] = useState<number | null>(presetId);
  // `?account=<id>` names the savings account a statement reads. There is no
  // picker: the statement is opened from the account's own page.
  const accountId = report?.accountParam ? accountParam : null;
  const [presetMember, setPresetMember] = useState<MemberOption | null>(null);
  const [doc, setDoc] = useState<ReportDocument | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const { branches, loading: branchesLoading } = useBranches();
  // Without `branches:view_all` the API answers 403 to a branch outside the
  // caller's own, so the picker offers only theirs.
  const picker = branchPicker(branches, user, hasPermission("branches:view_all"));
  // The branch the report runs and is labelled on: a choice the picker doesn't
  // offer (a linked id it hasn't loaded yet, or one this user can't pick) reads
  // as no branch, so the label never names one the request doesn't send.
  const branchId = linkedBranchId(branchChoice, picker.branches, !branchesLoading);
  // A linked branch still waiting on the list holds Generate, so the first run
  // can't go out for every branch while the link asked for one.
  const branchPending = branchChoice !== null && branchesLoading;
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  const loadBranding = useBrandingStore((s) => s.load);

  const [logoData, setLogoData] = useState<string | null>(null);

  useEffect(() => {
    if (presetId === null) return;
    let cancelled = false;
    borrowerService
      .detail(presetId)
      .then((member) => {
        if (!cancelled) setPresetMember(toMemberOption(member));
      })
      .catch(() => {
        if (cancelled) return;
        setSubjectId((current) => (current === presetId ? null : current));
        toast.error("We couldn't open that member. Please pick one.");
      });
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  // Warms branding for the case where Reports is the first page of the session
  // to need it, so the logo is on screen before anyone clicks Generate. The
  // store no-ops once loaded, so this is cheap — and it is only a head start:
  // correctness of the letterhead is `applyChrome`'s await, not this effect.
  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  // Encoded once per logo rather than per export, and never awaited by the
  // Generate path — an unreachable logo must not hold up a report.
  useEffect(() => {
    let cancelled = false;
    loadLogoDataUrl(logoUrl).then((data) => {
      if (!cancelled) setLogoData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const activeRange = preset === "custom" ? range : presetRange(preset, range);

  if (!report) {
    return (
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
    );
  }

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      setRange(presetRange(p, range));
      setDoc(null);
    }
  }

  // The "Branch:" line on screen and in every export. Without `view_all` an
  // unfiltered report covers only the caller's branches, so it says so.
  const branchLabel = report.supportsBranch
    ? pickedBranchLabel(picker, branchId, ALL_BRANCHES_LABEL)
    : null;

  // Subject-scoped reports cannot run against nothing.
  const missingSubject = (!!report.subject && !subjectId) || (!!report.accountParam && !accountId);

  // The API caps the reporting period, so a range wider than that is a 422 the
  // user can see coming. Mirrors `ReportController::assertSpanWithinCap`; only
  // the two custom date inputs can reach it, since every preset is narrower.
  const spanTooWide = exceedsReportSpanCap(activeRange);

  // What the preview and the CSV are scoped to, so the two always agree.
  const scope = {
    range: activeRange,
    branchId: report.supportsBranch ? branchId : null,
    subjectId: report.subject ? subjectId : report.accountParam ? accountId : null,
    productId: report.supportsProduct ? (productIdParam(product.value) ?? null) : null,
    groupBy: report.groupBy ? groupBy : null,
  };

  async function handleGenerate() {
    if (!report || missingSubject || spanTooWide || branchPending) return;
    setGenerating(true);
    try {
      const built = await report.build(scope);
      // A product filter says so on screen and in every export.
      const result =
        scope.productId && product.label
          ? {
              ...built,
              meta: {
                ...built.meta,
                subtitle: [built.meta.subtitle, `Product: ${product.label}`].filter(Boolean).join(" · "),
              },
            }
          : built;
      // Identity is stamped once, here, so the preview and every exported
      // format quote the same reference, logo, and preparer.
      //
      // Awaited, and that await is the point: `applyChrome` resolves the
      // organization name from the branding store, and Generate on a cold page
      // load can beat the branding fetch. Not waiting stamps `Lendy.PH` into
      // this cooperative's letterhead permanently — the document keeps the
      // string, so every PDF/Word/Excel/CSV export of it is wrong too. The
      // store shares one in-flight promise, so this waits on the request the
      // effect above already started and never issues a second.
      setDoc(
        await applyChrome(result, {
          logoUrl,
          logoData,
          preparedBy: user?.full_name ?? user?.username ?? null,
          branchLabel,
        })
      );
    } catch {
      toast.error("We couldn't generate the report. Please try again.");
      setDoc(null);
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Every exporter is loaded on demand, and none of them at import time.
   *
   * Statically importing the four pulled exceljs, docx, jspdf and
   * jspdf-autotable into this route's client chunk, so opening any report paid
   * for all four libraries before a single figure rendered — on a field
   * officer's mobile data, on every report view, whether or not anything was
   * ever exported. `await import()` moves that cost to the click that needs it.
   *
   * `exportingFormat` already covers the wait: the button spins from the moment
   * the menu item is chosen, which now spans the chunk fetch as well as the
   * encode. A failed chunk fetch rejects like any other export failure and
   * lands in the same catch below.
   */
  async function handleExport(format: ExportFormat) {
    if (!doc || !report) return;
    setExportingFormat(format);
    try {
      switch (format) {
        case "excel": {
          const { exportReportToExcel } = await import("../_lib/report-excel");
          await exportReportToExcel(doc);
          toast.success("Excel file downloaded.");
          break;
        }
        case "pdf": {
          const { exportReportToPdf } = await import("../_lib/report-pdf");
          exportReportToPdf(doc);
          toast.success("PDF downloaded.");
          break;
        }
        case "docx": {
          const { exportReportToDocx } = await import("../_lib/report-docx");
          await exportReportToDocx(doc);
          toast.success("Word document downloaded.");
          break;
        }
        case "csv": {
          const backendExporter = reportId
            ? backendCsvExporter(reportId as ReportId, scope.subjectId ?? null)
            : undefined;
          if (backendExporter) {
            // The scope has to travel with the export, or a branch-filtered
            // report downloads as the whole book while the preview beside it
            // shows one branch.
            const blob = await backendExporter({
              date_from: activeRange.from,
              date_to: activeRange.to,
              ...reportScopeParams(scope),
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = csvFileName(reportId as string, report, activeRange, todayISO());
            link.click();
            URL.revokeObjectURL(url);
          } else {
            const { exportReportToCsv } = await import("../_lib/report-csv");
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
    <PageFill className="fit:gap-3">
      {/* Breadcrumb + back */}
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
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
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
            noCsv={report.noCsv === true}
            exportingFormat={exportingFormat}
            onExport={handleExport}
          />
        </div>
      </div>

      {/* Controls card */}
      {/* At fit the card is compact: the date presets stay on one row that
          scrolls sideways, so the preview below keeps most of the screen. */}
      <Card className="shrink-0 fit:py-0">
        <CardContent className="p-4 sm:p-5 fit:p-3">
          <div className="flex flex-col gap-4 fit:gap-3 lg:flex-row lg:items-end lg:justify-between">
            {report.noDateRange ? (
              <p className="text-sm text-muted-foreground min-w-0 flex-1">
                {noDateRangeScope(report.subject)}
              </p>
            ) : (
              <div className="space-y-2 fit:space-y-1 min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date Range
                </p>
                {/* At fit one row that scrolls sideways. Its right edge fades
                    while more presets lie beyond it; the trailing padding lets
                    the last one scroll clear of the fade. */}
                <div className="flex flex-wrap gap-1.5 fit:flex-nowrap fit:overflow-x-auto fit:pb-0.5 fit:pr-8 fit:scroll-pe-8 fit:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={cn(
                        "h-8 shrink-0 whitespace-nowrap px-3 text-xs rounded-md border transition-colors",
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
            )}

            <div className="flex items-end gap-2">
              {!report.noDateRange && (
                <>
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
                </>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating || missingSubject || spanTooWide || branchPending}
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

          {/* Scope row — only the reports whose endpoints accept these
              filters get to show them, so the controls never imply a
              narrowing the API would silently ignore. */}
          {(report.supportsBranch ||
            report.supportsProduct ||
            report.groupBy ||
            report.subject ||
            report.accountParam) && (
            <div className="mt-4 flex flex-wrap items-end gap-4 border-t pt-4 fit:mt-3 fit:gap-3 fit:pt-3">
              {report.supportsBranch && (
                <div className="space-y-1">
                  <Label className="text-xs">Branch</Label>
                  <Select
                    value={branchId === null ? ALL_BRANCHES : String(branchId)}
                    onValueChange={(v: string | null) => {
                      setBranchChoice(
                        !v || v === ALL_BRANCHES ? null : Number(v)
                      );
                      setDoc(null);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56">
                      <SelectValue>{() => branchLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_BRANCHES}>
                        {pickedBranchLabel(picker, null, ALL_BRANCHES_LABEL)}
                      </SelectItem>
                      {picker.branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {report.supportsProduct && (
                <ProductFilter
                  value={product.value}
                  kind={report.productKind}
                  onChange={(value, label) => {
                    setProduct({ value, label });
                    setDoc(null);
                  }}
                />
              )}

              {report.groupBy && groupBy !== null && (
                <div className="space-y-1">
                  <Label htmlFor="report-group-by" className="text-xs">
                    {report.groupBy.label}
                  </Label>
                  <OptionSelect
                    id="report-group-by"
                    value={groupBy}
                    onChange={(value) => {
                      setGroupBy(value);
                      setDoc(null);
                    }}
                    options={report.groupBy.options}
                    className="h-9 w-40"
                  />
                </div>
              )}

              {report.subject && (
                <SubjectPicker
                  subject={report.subject}
                  value={subjectId}
                  onChange={(id) => {
                    setSubjectId(id);
                    setDoc(null);
                  }}
                  presetId={presetId}
                  presetMember={presetMember}
                />
              )}

              {missingSubject && report.subject && (
                <p className="text-xs text-muted-foreground pb-2">
                  Select a {reportSubjectNoun(report.subject)} to generate this report.
                </p>
              )}

              {missingSubject && report.accountParam && (
                <p className="text-xs text-muted-foreground pb-2">{ACCOUNT_REPORT_HINT}</p>
              )}

              {spanTooWide && (
                <p className="text-xs text-destructive pb-2">
                  The reporting period may not exceed {MAX_REPORT_SPAN_YEARS}{" "}
                  years. Narrow the date range to generate this report.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview area */}
      {!doc && !generating && (
        <EmptyPreview
          reportTitle={report.title}
          pick={reportPickPrompt(report)}
        />
      )}
      {generating && (
        <div className="rounded-xl border bg-muted/30 py-24 flex items-center justify-center fit:flex-1 fit:min-h-0 fit:py-0">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Fetching data &amp; building preview…</p>
          </div>
        </div>
      )}
      {/* The preview scrolls in its own card at fit, and opens full size. A
          plain scroller, not a ScrollBox: the preview keeps its own header band
          and totals tint (shared with print), so its tables are left unpinned. */}
      {doc && !generating && (
        <ExpandableCard title="Preview">
          <div data-unpinned className="min-w-0 overflow-x-auto fit:flex-1 fit:min-h-0 fit:overflow-auto p-px">
            <ReportPreview doc={doc} />
          </div>
        </ExpandableCard>
      )}
      {doc && !generating && <ReportPrintSheet doc={doc} />}
    </PageFill>
  );
}

/**
 * Keyed by everything a link presets (member, account, period and branch), so
 * following a second link to the same report starts afresh.
 */
function ReportDetailRoute() {
  const searchParams = useSearchParams();
  const memberParam = presetMemberId(searchParams.get("member"));
  const accountParam = presetAccountId(searchParams.get("account"));
  const periodParam = presetPeriodRange(searchParams.get("from"), searchParams.get("to"));
  const branchParam = presetBranchId(searchParams.get("branch"));
  const key = [
    memberParam ?? "none",
    accountParam ?? "none",
    periodParam ? `${periodParam.from}..${periodParam.to}` : "none",
    branchParam ?? "none",
  ].join(":");
  return (
    <ReportDetailContent
      key={key}
      memberParam={memberParam}
      accountParam={accountParam}
      periodParam={periodParam}
      branchParam={branchParam}
    />
  );
}

export default function ReportDetailPage() {
  return (
    <RouteGuard permission="reports:view" pageName="Reports">
      <Suspense fallback={null}>
        <ReportDetailRoute />
      </Suspense>
    </RouteGuard>
  );
}

interface ExportMenuProps {
  doc: ReportDocument | null;
  /** Hides the CSV export for a report the server writes no CSV for. */
  noCsv?: boolean;
  exportingFormat: ExportFormat | null;
  onExport: (format: ExportFormat) => void;
}

function ExportMenu({ doc, noCsv = false, exportingFormat, onExport }: ExportMenuProps) {
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
            {EXPORT_FORMATS.filter((fmt) => !(noCsv && fmt.id === "csv")).map((fmt) => {
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

function EmptyPreview({ reportTitle, pick }: { reportTitle: string; pick: string }) {
  return (
    // At fit it fills the space left and centres in it (my-auto, not
    // justify-center, so a short space scrolls instead of cutting the top).
    <div className="flex flex-col rounded-xl border border-dashed bg-muted/20 py-16 px-6 fit:flex-1 fit:min-h-0 fit:overflow-auto fit:py-0">
      <div className="max-w-md mx-auto my-auto text-center space-y-3 fit:space-y-2">
        {hasIllustration("pickReport") ? (
          <Illustration name="pickReport" className="mx-auto fit:max-h-[min(8rem,14dvh)]" />
        ) : (
          <div className="mx-auto h-12 w-12 rounded-full bg-brand-orange/10 flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-brand-orange" />
          </div>
        )}
        <h3 className="text-base font-semibold">
          Ready to generate {reportTitle}
        </h3>
        <p className="text-sm text-muted-foreground">
          Pick {pick} above and click{" "}
          <span className="font-medium text-foreground">Generate Preview</span>.
          What you see will match the exported Excel exactly.
        </p>
      </div>
    </div>
  );
}
