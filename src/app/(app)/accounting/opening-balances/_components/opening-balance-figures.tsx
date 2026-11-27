import { AlertTriangle } from "lucide-react";
import type { OpeningBalance } from "@/types";
import { figuresView, openingWarnings, postedJournalsWarning } from "../_lib/opening-balances";

interface OpeningBalanceFiguresProps {
  opening: OpeningBalance;
  /** Unsaved edits: every figure reads a dash until the next save. */
  dirty: boolean;
}

/**
 * Totals, Difference and Balanced from the server's last answer, its date
 * warning, and its `warnings[]` as sent. None of them blocks Finalise.
 */
export function OpeningBalanceFigures({ opening, dirty }: OpeningBalanceFiguresProps) {
  const figures = figuresView(opening, dirty);
  const warnings = [
    postedJournalsWarning(opening.posted_journals_on_or_before_as_of),
    ...openingWarnings(opening),
  ].filter((text): text is string => text !== null);
  const items: Array<[string, string]> = [
    ["Total debit", figures.totalDebit],
    ["Total credit", figures.totalCredit],
    ["Difference", figures.difference],
    ["Balanced", figures.balanced],
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {figures.hint && <p className="text-xs text-muted-foreground">{figures.hint}</p>}
      {warnings.map((warning) => (
        <div
          key={warning}
          role="note"
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}
