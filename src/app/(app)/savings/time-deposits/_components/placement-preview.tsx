"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateLong, formatRate } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { timeDepositService } from "@/services";
import type { TimeDepositQuote, TimeDepositQuoteInput } from "@/types";

interface PlacementPreviewProps {
  /** The placement as typed, or null while it is incomplete. */
  input: TimeDepositQuoteInput | null;
}

/**
 * The server's figures for the placement (`POST /savings/time-deposits/quote`),
 * fetched on request. A quote belongs to the inputs it was asked for, so
 * changing any of them hides it until it is asked for again.
 */
export function PlacementPreview({ input }: PlacementPreviewProps) {
  const [quoted, setQuoted] = useState<{ key: string; quote: TimeDepositQuote } | null>(null);
  const [loading, setLoading] = useState(false);
  const key = input ? JSON.stringify(input) : "";
  const quote = quoted && quoted.key === key ? quoted.quote : null;

  function ask() {
    if (!input) return;
    setLoading(true);
    timeDepositService
      .quote(input)
      .then((q) => setQuoted({ key, quote: q }))
      .catch((err: unknown) => notifyError(err, "Couldn't get the placement's figures."))
      .then(() => setLoading(false));
  }

  if (!quote) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <span className="text-muted-foreground">
          {input ? "See what this placement earns before placing it." : "Fill in the product, term, amount and date to see what it earns."}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={ask} disabled={!input || loading}>
          {loading ? "Working it out…" : "Show figures"}
        </Button>
      </div>
    );
  }

  const rows: Array<[string, string]> = [
    ["Rate", `${formatRate(quote.annual_rate)}% a year`],
    ["Matures on", formatDateLong(quote.maturity_date)],
    ["Interest for the term", formatCurrency(quote.gross_interest)],
    [`Less withholding tax (${formatRate(quote.withholding_tax_rate)}%)`, formatCurrency(quote.withholding_tax)],
    ["Net interest", formatCurrency(quote.net_interest)],
    ["Amount at maturity", formatCurrency(quote.maturity_amount)],
  ];
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
      <dl className="space-y-1">
        {rows.map(([label, value], i) => (
          <div key={label} className={`flex justify-between gap-3 ${i === rows.length - 1 ? "border-t pt-1 font-semibold" : ""}`}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">The server&apos;s figures; the certificate shows the same.</p>
    </div>
  );
}
