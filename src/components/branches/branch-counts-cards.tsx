"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { branchCountCards } from "@/lib/branch-counts";
import { cn } from "@/lib/utils";
import { interbranchTransferService } from "@/services/interbranch-transfer.service";
import { useAuthStore } from "@/store";

interface BranchCountsCardsProps {
  className?: string;
}

/**
 * The branch dashboard counts (`GET /branch-counts`): transfers waiting for
 * approval and in transit, suspended branches and branches not yet
 * reconciled, each in the caller's branches. Self-contained, so any page can
 * place it. The endpoint needs `dashboard:analytics`; without it nothing is
 * requested and nothing renders. A figure the caller can't see reads
 * "Not available", never 0.
 */
export function BranchCountsCards({ className }: BranchCountsCardsProps) {
  const allowed = useAuthStore((s) => s.hasPermission("dashboard:analytics"));
  const fetcher = useCallback(() => interbranchTransferService.counts(), []);
  const resource = useApiResource(fetcher, allowed);

  if (!allowed || resource.unavailable) return null;

  if (resource.error && !resource.data) {
    return (
      <p className={cn("shrink-0 text-sm text-muted-foreground", className)} role="status">
        The branch counts could not be loaded.
      </p>
    );
  }

  const cards = branchCountCards(resource.data);
  const loading = resource.loading && !resource.data;

  return (
    <section
      aria-label="Branch counts"
      aria-busy={loading || undefined}
      className={cn("grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}
    >
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className="space-y-1 py-3">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" aria-hidden />
            ) : (
              <p className={cn("text-2xl font-semibold tabular-nums", !card.available && "text-base text-muted-foreground")}>
                {card.value}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
