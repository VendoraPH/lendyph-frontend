import { formatCurrencyExact, formatDate } from "@/lib/format";
import { ESTIMATE_DAY_BASIS, estimatePlacement } from "../../_lib/time-deposit-rules";

interface PlacementPreviewProps {
  principal: number;
  ratePct: number;
  termDays: number;
  withholdingPct: number;
  placementDate: string;
}

/** What the placement should earn, before the server computes the real figures. */
export function PlacementPreview({ principal, ratePct, termDays, withholdingPct, placementDate }: PlacementPreviewProps) {
  const e = estimatePlacement(principal, ratePct, termDays, withholdingPct, placementDate);
  const rows = [
    ["Matures on", formatDate(e.maturityDate)],
    ["Interest for the term", formatCurrencyExact(e.grossInterest)],
    [`Less withholding tax (${withholdingPct}%)`, formatCurrencyExact(e.withholdingTax)],
    ["Amount at maturity", formatCurrencyExact(e.maturityAmount)],
  ];
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <dl className="space-y-1">
        {rows.map(([label, value], i) => (
          <div key={label} className={`flex justify-between gap-3 ${i === rows.length - 1 ? "border-t pt-1 font-semibold" : ""}`}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Estimate on a {ESTIMATE_DAY_BASIS}-day year. The certificate shows the figures the server computes.
      </p>
    </div>
  );
}
