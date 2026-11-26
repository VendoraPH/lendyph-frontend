"use client";

import { useMenuVisibility } from "@/hooks/use-menu-visibility";
import { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { useAuth } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryDescription, visibleAmlaReports, visibleReports } from "./_lib/report-catalog";
import { reportIcon3D } from "./_lib/report-icons-3d";
import { Icon3D } from "@/components/common/icon-3d";
import { CATEGORY_ILLUSTRATION, CATEGORY_META } from "./_lib/types";
import type { AmlaReportDefinition, ReportCategory, ReportDefinition } from "./_lib/types";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { hasIllustration, Illustration } from "@/components/common/illustration";
import { amlaExportAllowed } from "@/lib/amla/reports-access";
import type { Permission } from "@/types";

/** Whether a report's title or description holds what was typed in the search. */
function matches(report: { title: string; description: string }, needle: string): boolean {
  return !needle || report.title.toLowerCase().includes(needle) || report.description.toLowerCase().includes(needle);
}

export default function ReportsPage() {
  const [query, setQuery] = useState("");
  const { hasPermission } = useAuth();
  // A score of reports, filtered per render: cheap, and never stale when the
  // user's permissions change.
  // Menu Visibility leaves out the reports of hidden menus (Savings, Share Capital, Accounting, AMLA).
  const { isHidden } = useMenuVisibility();
  const catalog = visibleReports(hasPermission, isHidden);
  // The AMLA reports are made by the server on their own pages, so they sit in their own section (AMLA-B7).
  const amlaReports = visibleAmlaReports(hasPermission, isHidden);
  const needle = query.trim().toLowerCase();
  const amlaShown = amlaReports.filter((r) => matches(r, needle));

  const grouped = (() => {
    const filtered = catalog.filter((r) => matches(r, needle));
    const byCategory = new Map<ReportCategory, ReportDefinition[]>();
    filtered.forEach((r) => {
      const list = byCategory.get(r.category) ?? [];
      list.push(r);
      byCategory.set(r.category, list);
    });
    return byCategory;
  })();

  // Derived from CATEGORY_META rather than listed here, in declaration order.
  // A hardcoded list silently hides every report in a category someone forgets
  // to add — which is exactly what happened when `financial` and `performance`
  // arrived: six new reports built, catalogued and reachable by URL, and five
  // of them invisible on this page.
  const orderedCategories = Object.keys(CATEGORY_META) as ReportCategory[];

  const hasResults = Array.from(grouped.values()).some((v) => v.length > 0) || amlaShown.length > 0;

  return (
    <RouteGuard permission="reports:view" pageName="Reports">
      <PageFill>
        {/* Hero / header */}
        <div className="shrink-0 rounded-xl border bg-gradient-to-br from-brand-orange/10 via-background to-background p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
                <Icon3D name="pick-report" size={36} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Reports
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Pick a report, preview it, then export to Excel. What you see
                  in the preview is what you&apos;ll get in the file — titles,
                  totals, and all.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="gap-1 border-brand-orange/30 bg-brand-orange/10 text-brand-orange"
                  >
                    <Sparkles className="h-3 w-3" />
                    WYSIWYG preview
                  </Badge>
                  <span className="text-muted-foreground">
                    {catalog.length + amlaReports.length} reports available
                  </span>
                </div>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports…"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Catalog */}
        {!hasResults ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            {hasIllustration("noResults") && <Illustration name="noResults" />}
            <p>
              No reports match <span className="font-medium">&ldquo;{query}&rdquo;</span>.
            </p>
          </div>
        ) : (
          <ScrollBox className="space-y-8 p-px">
            {orderedCategories.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0) return null;
              const meta = CATEGORY_META[cat];
              return (
                <section key={cat}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Illustration
                        name={CATEGORY_ILLUSTRATION[cat]}
                        className="h-14 max-h-14 w-14 shrink-0"
                      />
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {meta.label}
                        </h2>
                        <p className="text-xs text-muted-foreground/80">
                          {categoryDescription(cat, catalog)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {items.length}{" "}
                      {items.length === 1 ? "report" : "reports"}
                    </span>
                  </div>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((report) => (
                      <ReportCard key={report.id} report={report} href={`/reports/${report.id}`} />
                    ))}
                  </div>
                </section>
              );
            })}
            {amlaShown.length > 0 && <AmlaSection reports={amlaShown} can={hasPermission} />}
          </ScrollBox>
        )}
      </PageFill>
    </RouteGuard>
  );
}

/** The AMLA Compliance category: only the reports this user's AMLA keys open, each on its page under /amla/reports. */
function AmlaSection({ reports, can }: { reports: AmlaReportDefinition[]; can: (permission: Permission) => boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {hasIllustration("emptyCompliance") && <Illustration name="emptyCompliance" className="h-14 max-h-14 w-14 shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">AMLA Compliance</h2>
            <p className="text-xs text-muted-foreground/80">
              Anti-money laundering reports, made by the server. Each report you open or export is recorded in the AMLA log.
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {reports.length} {reports.length === 1 ? "report" : "reports"}
        </span>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reports.map((report) => (
          <ReportCard
            key={report.key}
            report={report}
            href={report.href}
            footer={amlaExportAllowed(report, can) ? "Shown on request · PDF, Excel and CSV" : "Shown on request"}
          />
        ))}
      </div>
    </section>
  );
}

interface ReportCardProps {
  report: Pick<ReportDefinition, "title" | "description" | "icon" | "accent">;
  /** The report's page: `/reports/<id>`, or an AMLA report's under /amla/reports. */
  href: string;
  /** What opening it offers; the in-browser reports preview and export to Excel. */
  footer?: string;
}

function ReportCard({ report, href, footer = "Preview · Excel export" }: ReportCardProps) {
  return (
    <Link
      href={href}
      aria-label={`Open ${report.title}`}
      className="group text-left"
    >
      <Card
        className={cn(
          "h-full border transition-all",
          "group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-brand-orange/30",
          "group-focus-visible:ring-2 group-focus-visible:ring-brand-orange/40 group-focus-visible:outline-none"
        )}
      >
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1",
                report.accent.bg,
                report.accent.ring
              )}
            >
              <Icon3D name={reportIcon3D(report.icon)} size={30} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                {report.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                {report.description}
              </p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground/70">
              {footer}
            </span>
            <span className="text-xs font-medium text-brand-orange group-hover:underline">
              Open →
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
