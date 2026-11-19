"use client";

import type { ReactNode } from "react";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { Skeleton } from "@/components/ui/skeleton";
import { DATA_UNAVAILABLE, formatMetric, type MetricFormat } from "../../_lib/metrics";
import type { Source } from "../../_lib/executive-data";

/** A dashboard section: a collapsible card with an icon and an optional note under its body. */
export function SectionShell({
  title,
  icon,
  note,
  children,
}: {
  title: string;
  icon: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  return (
    <CollapsibleCard title={title} icon={icon} className="rounded-xl border border-border shadow-sm">
      {children}
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </CollapsibleCard>
  );
}

/**
 * What a chart or table shows instead of itself: a placeholder while its
 * source loads, "No access" when the user may not read it, and "Data
 * Unavailable" when it failed or arrived empty. Renders `children` otherwise.
 */
export function SourceGate({
  source,
  empty,
  emptyText = "No records for this selection.",
  height = "h-[220px]",
  notice = null,
  children,
}: {
  source: Source<unknown>;
  /**
   * Shown instead of the figures whatever the source holds: "No snapshot for
   * this date" for a balance on a past period, "Requires configuration" for
   * books that aren't set up.
   */
  notice?: string | null;
  /** True when the source arrived but has nothing to draw. */
  empty?: boolean;
  emptyText?: string;
  height?: string;
  children: ReactNode;
}) {
  if (notice === null && source.state === "loading") return <Skeleton className={`${height} w-full`} />;
  const message =
    notice ??
    (source.state === "denied"
      ? "No access: your role cannot view this data."
      : source.state === "error"
        ? DATA_UNAVAILABLE
        : empty
          ? emptyText
          : null);
  if (message) {
    return (
      <div className={`flex ${height} items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground`}>
        {message}
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * A tile's text for a figure from `source`: "No access" when the user may not
 * read it, a dash while it loads, else the server's figure ("Data
 * Unavailable" when it wasn't sent).
 */
export function figureText(source: Source<unknown>, value: number | null, format: MetricFormat): string {
  if (source.state === "denied") return "No access";
  if (source.state === "loading") return "—";
  return formatMetric(value, format);
}

/** A small labelled figure, for the section tiles. */
export function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
