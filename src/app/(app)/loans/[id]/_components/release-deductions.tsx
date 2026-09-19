import type { LoanDeduction } from "@/types/loan";
import { formatCurrency } from "@/lib/format";

interface Props {
  deductions?: LoanDeduction[];
  totalDeductions?: number;
}

export function ReleaseDeductions({ deductions, totalDeductions }: Props) {
  const items = Array.isArray(deductions) ? deductions : [];
  return (
    <section className="space-y-2" aria-labelledby="release-deductions-title">
      <h3 id="release-deductions-title" className="text-sm font-medium">Fee deductions</h3>
      <p className="text-xs text-muted-foreground">Fees currently recorded on this loan. Insurance is shown separately below.</p>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No itemized fees recorded.</p>}
      <dl className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex justify-between gap-4">
            <dt>{item.name}</dt>
            <dd className="tabular-nums shrink-0">{formatCurrency(item.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-2 font-medium">
          <dt>Total recorded deductions</dt>
          <dd className="tabular-nums">{totalDeductions != null ? formatCurrency(totalDeductions) : "Unavailable"}</dd>
        </div>
      </dl>
    </section>
  );
}
