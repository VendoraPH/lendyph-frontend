"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORT_CATALOG } from "./_lib/report-catalog";
import { CATEGORY_META } from "./_lib/types";
import type { ReportCategory, ReportDefinition } from "./_lib/types";

export default function ReportsPage() {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = REPORT_CATALOG.filter((r) => {
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle)
      );
    });
    const byCategory = new Map<ReportCategory, ReportDefinition[]>();
    filtered.forEach((r) => {
      const list = byCategory.get(r.category) ?? [];
      list.push(r);
      byCategory.set(r.category, list);
    });
    return byCategory;
  }, [query]);

  // Derived from CATEGORY_META rather than listed here, in declaration order.
  // A hardcoded list silently hides every report in a category someone forgets
  // to add — which is exactly what happened when `financial` and `performance`
  // arrived: six new reports built, catalogued and reachable by URL, and five
  // of them invisible on this page.
  const orderedCategories = Object.keys(CATEGORY_META) as ReportCategory[];

  const hasResults = Array.from(grouped.values()).some((v) => v.length > 0);

  return (
    <RouteGuard permission="reports:view" pageName="Reports">
      <div className="space-y-6">
        {/* Hero / header */}
        <div className="rounded-xl border bg-gradient-to-br from-brand-orange/10 via-background to-background p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
                <FileBarChart className="h-6 w-6" />
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
                    {REPORT_CATALOG.length} reports available
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
          <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            No reports match <span className="font-medium">&ldquo;{query}&rdquo;</span>.
          </div>
        ) : (
          <div className="space-y-8">
            {orderedCategories.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0) return null;
              const meta = CATEGORY_META[cat];
              return (
                <section key={cat}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {meta.label}
                      </h2>
                      <p className="text-xs text-muted-foreground/80">
                        {meta.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {items.length}{" "}
                      {items.length === 1 ? "report" : "reports"}
                    </span>
                  </div>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((report) => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

interface ReportCardProps {
  report: ReportDefinition;
}

function ReportCard({ report }: ReportCardProps) {
  const Icon = report.icon;
  return (
    <Link
      href={`/reports/${report.id}`}
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
              <Icon className={cn("h-5 w-5", report.accent.text)} />
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
              Preview · Excel export
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
