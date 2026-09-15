"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCentavos } from "@/lib/accounting/money";
import { cn } from "@/lib/utils";

export interface ReportSectionLine {
  key: string;
  code?: string;
  label: string;
  /** Centavos, already netted into the direction the section reads. */
  amount: number;
}

interface ReportSectionProps {
  title: string;
  lines: ReportSectionLine[];
  total: number;
  totalLabel?: string;
  /** An extra line under the total, e.g. "Total liabilities and equity". */
  footer?: { label: string; amount: number };
  emptyMessage?: string;
}

/**
 * One block of a financial statement: a heading, its lines, and its total.
 *
 * Shared by the balance sheet, income statement and cash flow because all
 * three are the same shape — a list of netted account amounts under a
 * subtotal. Negative amounts are shown in parentheses, which is how every
 * accountant reading this expects to see a contra or a loss.
 */
export function ReportSection({
  title,
  lines,
  total,
  totalLabel,
  footer,
  emptyMessage = "Nothing in this section.",
}: ReportSectionProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>

        {lines.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-1">
            {lines.map((line) => (
              <div
                key={line.key}
                className="flex items-baseline justify-between gap-4 py-1"
              >
                <span className="flex min-w-0 items-baseline gap-2 text-sm">
                  {line.code && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.code}
                    </span>
                  )}
                  <span className="truncate">{line.label}</span>
                </span>
                <Amount value={line.amount} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-baseline justify-between gap-4 border-t pt-3">
          <span className="text-sm font-semibold">
            {totalLabel ?? `Total ${title.toLowerCase()}`}
          </span>
          <Amount value={total} className="font-semibold" />
        </div>

        {footer && (
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t pt-2">
            <span className="text-sm font-semibold">{footer.label}</span>
            <Amount value={footer.amount} className="font-semibold" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Parentheses for negatives — accounting convention, not a minus sign. */
export function Amount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const negative = value < 0;
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums",
        negative && "text-red-600",
        className,
      )}
    >
      {negative
        ? `(${formatCentavos(-value)})`
        : formatCentavos(value)}
    </span>
  );
}
