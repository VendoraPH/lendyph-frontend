"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks/use-api-resource";
import { branchCountCards } from "@/lib/branch-counts";
import { cn } from "@/lib/utils";
import { interbranchTransferService } from "@/services/interbranch-transfer.service";
import { useAuthStore } from "@/store";

interface BranchCountsCardsProps {
  className?: string;
  /** Change it to reload the counts, after a step that changes them. */
  refreshKey?: number;
}

/**
 * The branch dashboard counts (`GET /branch-counts`): transfers waiting for
 * approval and in transit, suspended branches and branches not yet
 * reconciled, each in the caller's branches. One compact row, so the lists
 * below keep their height. Self-contained, so any page can place it. The
 * endpoint needs `dashboard:analytics`; without it nothing is requested and
 * nothing renders. A figure the caller can't see reads "Not available",
 * never 0. Each card's hint is its tooltip and its accessible description.
 */
export function BranchCountsCards({ className, refreshKey = 0 }: BranchCountsCardsProps) {
  const allowed = useAuthStore((s) => s.hasPermission("dashboard:analytics"));
  // A new fetcher for each key: the resource requests again and keeps the last
  // figures on screen meanwhile.
  const fetcher = useCallback(() => {
    void refreshKey;
    return interbranchTransferService.counts();
  }, [refreshKey]);
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
      className={cn("grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4", className)}
    >
      {cards.map((card) => (
        <div
          key={card.key}
          title={card.hint}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
        >
          <span className="text-xs text-muted-foreground">
            {card.label}
            <span className="sr-only">. {card.hint}</span>
          </span>
          {loading ? (
            <span className="h-5 w-8 animate-pulse rounded bg-muted" aria-hidden />
          ) : (
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                card.available ? "text-lg" : "text-xs text-muted-foreground",
              )}
            >
              {card.value}
            </span>
          )}
        </div>
      ))}
    </section>
  );
}
