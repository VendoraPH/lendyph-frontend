"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileStack, Printer, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRINTABLE_CATALOG } from "@/lib/printables/catalog";
import { SUBJECT_META } from "@/lib/printables/types";
import type { PrintableDefinition, PrintableSubject } from "@/lib/printables/types";

/**
 * Documents catalog. Grouped by what you have to pick before the document can
 * be produced, because that is the first question staff answer anyway — "I
 * need something for this loan" / "for this member" / "for this payment".
 *
 * Deliberately the same card and accent treatment as `/reports`: the two pages
 * are the same kind of place, and making them look different would only imply
 * they behave differently.
 */

const ORDERED_SUBJECTS: PrintableSubject[] = ["loan", "borrower", "repayment"];

const SUBJECT_DESCRIPTION: Record<PrintableSubject, string> = {
  loan: "Documents issued against a single loan account",
  borrower: "Statements and certificates issued to a member",
  repayment: "Receipts issued for a payment",
};

/**
 * Accent per subject rather than per document, so adding a ninth printable
 * stays what it should be: one template file and one catalog entry.
 */
const SUBJECT_ACCENT: Record<
  PrintableSubject,
  { text: string; bg: string; ring: string }
> = {
  loan: { text: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
  borrower: { text: "text-purple-600", bg: "bg-purple-50", ring: "ring-purple-200" },
  repayment: { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
};

export default function PrintablesPage() {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = PRINTABLE_CATALOG.filter((p) => {
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle)
      );
    });
    const bySubject = new Map<PrintableSubject, PrintableDefinition[]>();
    filtered.forEach((p) => {
      const list = bySubject.get(p.subject) ?? [];
      list.push(p);
      bySubject.set(p.subject, list);
    });
    return bySubject;
  }, [query]);

  const hasResults = Array.from(grouped.values()).some((v) => v.length > 0);

  return (
    <RouteGuard permission="reports:view" pageName="Documents">
      <div className="space-y-6">
        {/* Hero / header */}
        <div className="rounded-xl border bg-gradient-to-br from-brand-orange/10 via-background to-background p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
                <FileStack className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Documents
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Pick a document, choose who or what it&apos;s for, and open it
                  ready to print. Every one carries your cooperative&apos;s
                  letterhead and a signature block.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="gap-1 border-brand-orange/30 bg-brand-orange/10 text-brand-orange"
                  >
                    <Printer className="h-3 w-3" />
                    Print-ready
                  </Badge>
                  <span className="text-muted-foreground">
                    {PRINTABLE_CATALOG.length} documents available
                  </span>
                </div>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Catalog */}
        {!hasResults ? (
          <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            No documents match{" "}
            <span className="font-medium">&ldquo;{query}&rdquo;</span>.
          </div>
        ) : (
          <div className="space-y-8">
            {ORDERED_SUBJECTS.map((subject) => {
              const items = grouped.get(subject) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={subject}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        By {SUBJECT_META[subject].label}
                      </h2>
                      <p className="text-xs text-muted-foreground/80">
                        {SUBJECT_DESCRIPTION[subject]}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {items.length}{" "}
                      {items.length === 1 ? "document" : "documents"}
                    </span>
                  </div>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((printable) => (
                      <PrintableCard key={printable.id} printable={printable} />
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

function PrintableCard({ printable }: { printable: PrintableDefinition }) {
  const Icon = printable.icon;
  const accent = SUBJECT_ACCENT[printable.subject];
  return (
    <Link
      href={`/printables/${printable.id}`}
      aria-label={`Open ${printable.title}`}
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
                accent.bg,
                accent.ring
              )}
            >
              <Icon className={cn("h-5 w-5", accent.text)} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                {printable.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                {printable.description}
              </p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground/70">
              Select {SUBJECT_META[printable.subject].label.toLowerCase()} · Print
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
