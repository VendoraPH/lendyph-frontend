"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatRate } from "@/lib/format";
import { bracketRangeLabel } from "@/components/loans/penalty-terms";
import type { PenaltyConfig } from "@/types/penalty";

interface PenaltyViewDialogProps {
  config: PenaltyConfig | null;
  /** The configuration's product names, never ids. */
  productNames: (c: PenaltyConfig) => string[];
  onOpenChange: (open: boolean) => void;
}

/** Read-only detail: products and the bracket table. */
export function PenaltyViewDialog({ config, productNames, onOpenChange }: PenaltyViewDialogProps) {
  const names = config ? productNames(config) : [];

  return (
    <Dialog open={config !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {config && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {config.name}
                <StatusBadge status={config.status} />
              </DialogTitle>
              <DialogDescription>
                Each late penalty charge uses the rate of the one condition its days late fall in.
              </DialogDescription>
            </DialogHeader>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Applicable loan products</h3>
              {names.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {names.map((name, i) => (
                    <Badge key={config.applicable_product_ids[i]} variant="secondary">{name}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None. An active configuration needs at least one.</p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Penalty conditions</h3>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Days late</th>
                      <th className="px-3 py-2 text-right font-medium">Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.conditions.map((c) => (
                      <tr key={c.days_from} className="border-t">
                        <td className="px-3 py-2">{bracketRangeLabel(c)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatRate(c.rate)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StatusBadge({ status }: { status: PenaltyConfig["status"] }) {
  return status === "active" ? (
    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
  );
}
