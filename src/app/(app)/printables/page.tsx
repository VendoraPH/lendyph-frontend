"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileStack, Printer, Search, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRINTABLE_CATALOG } from "@/lib/printables/catalog";
import { SUBJECT_ACCENT, SUBJECT_META } from "@/lib/printables/types";
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
 * The bulk-import workbook. It is in this catalog but not in
 * `PRINTABLE_CATALOG`: nothing about it is printed, and a ninth entry there
 * would have to invent a subject and a `build` it will never use.
 */
const IMPORT_TEMPLATE = {
  href: "/printables/data-template",
  title: "Data Import Template",
  description:
    "The member and loan workbook for migrating an existing book onto Lendyph.",
  /** Extra words the search should match, since none of them are on the card. */
  keywords: "csv excel xlsm bulk import migration upload template onboarding",
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

  const templateMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${IMPORT_TEMPLATE.title} ${IMPORT_TEMPLATE.description} ${IMPORT_TEMPLATE.keywords}`
      .toLowerCase()
      .includes(needle);
  }, [query]);

  const hasResults =
    templateMatches || Array.from(grouped.values()).some((v) => v.length > 0);

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

            {templateMatches && (
              <section>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Bulk import
                  </h2>
                  <p className="text-xs text-muted-foreground/80">
                    Bringing records in from another system
                  </p>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <CatalogCard
                    href={IMPORT_TEMPLATE.href}
                    icon={Table2}
                    // Not one of `SUBJECT_ACCENT`'s three on purpose: emerald
                    // means "repayment" everywhere else in this catalog.
                    accent={{
                      text: "text-teal-600",
                      bg: "bg-teal-50",
                      ring: "ring-teal-200",
                    }}
                    title={IMPORT_TEMPLATE.title}
                    description={IMPORT_TEMPLATE.description}
                    footer="Preview · Edit · Download"
                  />
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

function PrintableCard({ printable }: { printable: PrintableDefinition }) {
  return (
    <CatalogCard
      href={`/printables/${printable.id}`}
      icon={printable.icon}
      accent={SUBJECT_ACCENT[printable.subject]}
      title={printable.title}
      description={printable.description}
      footer={`Select ${SUBJECT_META[printable.subject].label.toLowerCase()} · Print`}
    />
  );
}

/**
 * The card treatment, shared by the eight printables and the import template.
 * Kept generic over `href`/`icon`/`accent` rather than over a
 * `PrintableDefinition`, because the template is not one — it takes no subject
 * and produces no letterhead.
 */
function CatalogCard({
  href,
  icon: Icon,
  accent,
  title,
  description,
  footer,
}: {
  href: string;
  icon: LucideIcon;
  accent: { text: string; bg: string; ring: string };
  title: string;
  description: string;
  footer: string;
}) {
  return (
    <Link href={href} aria-label={`Open ${title}`} className="group text-left">
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
              <h3 className="text-sm font-semibold leading-tight">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                {description}
              </p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground/70">{footer}</span>
            <span className="text-xs font-medium text-brand-orange group-hover:underline">
              Open →
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
