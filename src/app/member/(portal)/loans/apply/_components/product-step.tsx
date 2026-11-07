"use client";

import { useCallback } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { portalService } from "@/services/portal.service";
import type { PortalLoanEligibility, PortalLoanProduct } from "@/types/portal";

export const ELIGIBLE_NOTE = "You may apply for this loan. Final approval is subject to cooperative review.";

/** Choose a product and see, before filling anything, whether the member can apply. */
export function ProductStep({
  products,
  selectedId,
  onSelect,
  onEligibility,
}: {
  products: PortalLoanProduct[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Reports the check for the chosen product, or null while unknown. */
  onEligibility: (result: PortalLoanEligibility | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((p) => (
          <button key={p.id} type="button" className="text-left" onClick={() => onSelect(p.id)} aria-pressed={p.id === selectedId}>
            <Card className={cn("h-full transition-colors hover:bg-muted/40", p.id === selectedId && "ring-2 ring-brand-orange")}>
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium">{p.name}</p>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                <p>
                  {formatCurrency(p.min_amount)} – {formatCurrency(p.max_amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.min_term}–{p.max_term} {p.term_unit} · {formatRate(p.interest_rate)}% interest · paid {p.frequency}
                </p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
      {selectedId !== null && (
        <EligibilityPreview key={selectedId} productId={selectedId} onEligibility={onEligibility} />
      )}
    </div>
  );
}

function EligibilityPreview({
  productId,
  onEligibility,
}: {
  productId: number;
  onEligibility: (result: PortalLoanEligibility | null) => void;
}) {
  const fetcher = useCallback(
    () =>
      portalService.loanEligibility(productId).then((r) => {
        onEligibility(r);
        return r;
      }),
    [productId, onEligibility],
  );
  const { data, loading, unavailable, error } = useApiResource(fetcher);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking whether you can apply…
      </p>
    );
  }
  // Without the check the application still goes in; staff assess it.
  if (unavailable || error || !data) {
    return <p className="text-sm text-muted-foreground">Your cooperative checks eligibility when it reviews the application.</p>;
  }
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p className={cn("font-medium", data.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
        {data.eligible ? ELIGIBLE_NOTE : "You cannot apply for this loan yet."}
      </p>
      <ul className="space-y-1">
        {data.checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Met" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="Not met" />
            )}
            <span>
              {c.label}
              {c.detail && <span className="text-muted-foreground"> · {c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
