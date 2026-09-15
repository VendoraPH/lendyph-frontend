"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Landmark, ChevronDown, Loader2, ExternalLink } from "lucide-react";
import {
  SHARE_CAPITAL_UNAVAILABLE_LABEL,
  getShareCapitalBalance,
  hasShareCapitalBalance,
  shareCapitalUnavailableReason,
  type ShareCapitalBalance,
} from "@/utils/share-capital";

interface ShareCapitalCardProps {
  borrowerId: number | null | undefined;
  defaultOpen?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(amount) ? 0 : amount);
}

export function ShareCapitalCard({ borrowerId, defaultOpen = true }: ShareCapitalCardProps) {
  // This card's entire job is one figure, so it asks for exactly that rather
  // than re-summing a ledger it fetched itself. The credits/debits loop that
  // used to live here was the fourth copy of the same arithmetic, over a
  // `per_page: 9999` page the API clamps to 100 — so on a long-standing member
  // it printed the sum of their hundred most recent entries and called it
  // "Current Balance".
  const [result, setResult] = useState<ShareCapitalBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!borrowerId) return;
    let cancelled = false;
    setLoading(true);
    setResult(null);
    getShareCapitalBalance(borrowerId)
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [borrowerId]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger className="w-full text-left group/trigger">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Share Capital
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {!borrowerId ? (
              <p className="text-xs text-muted-foreground">No member linked.</p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading share capital…
              </div>
            ) : result === null || !hasShareCapitalBalance(result) ? (
              <div role="alert">
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-500">
                  {SHARE_CAPITAL_UNAVAILABLE_LABEL}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result === null
                    ? "The share capital ledger could not be loaded, so this member's balance is unknown — which is not the same as zero."
                    : shareCapitalUnavailableReason(result)}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="text-lg font-semibold text-brand-orange tabular-nums">
                    {formatCurrency(result.balance)}
                  </p>
                </div>
                <Link
                  href={`/borrowers/${borrowerId}?tab=share-capital`}
                  className="inline-flex items-center gap-1 text-xs text-brand-orange hover:underline"
                >
                  View full ledger
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
