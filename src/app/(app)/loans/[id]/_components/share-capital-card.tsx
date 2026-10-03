"use client";

import { useEffect, useState } from "react";
import { usePermission } from "@/hooks";
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
import { formatCurrency } from "@/lib/format";

interface ShareCapitalCardProps {
  borrowerId: number | null | undefined;
  /**
   * Changed by the page after an action that posts to the share-capital
   * ledger; a new value re-reads the balance. The card stays mounted, so an
   * open/closed choice survives the re-read.
   */
  version?: number;
  defaultOpen?: boolean;
}

export function ShareCapitalCard({ borrowerId, version = 0, defaultOpen = true }: ShareCapitalCardProps) {
  // This card's entire job is one figure, so it asks for exactly that rather
  // than re-summing a ledger it fetched itself. The credits/debits loop that
  // used to live here was the fourth copy of the same arithmetic, over a
  // `per_page: 9999` page the API clamps to 100 — so on a long-standing member
  // it printed the sum of their hundred most recent entries and called it
  // "Current Balance".
  //
  // The answer is stored with the member and `version` it was read for, and
  // loading is derived from that: until an answer for THIS `borrowerId` and
  // `version` arrives, the card is loading. So the first paint shows the
  // spinner rather than the "unavailable" alert, and neither a change of member
  // nor a re-read shows a balance that no longer applies. `result: null` means
  // the read itself failed.
  const [fetched, setFetched] = useState<{
    borrowerId: number;
    version: number;
    result: ShareCapitalBalance | null;
  } | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  // Without `share_capital:view` the ledger is not asked for, and the card
  // shows the balance as unavailable, as it does when the read is refused.
  const canReadShareCapital = usePermission().can("share_capital:view");

  useEffect(() => {
    if (!borrowerId) return;
    let cancelled = false;
    getShareCapitalBalance(borrowerId, canReadShareCapital)
      .catch(() => null)
      .then((next) => {
        if (!cancelled) setFetched({ borrowerId, version, result: next });
      });
    return () => {
      cancelled = true;
    };
  }, [borrowerId, version, canReadShareCapital]);

  const current =
    fetched !== null && fetched.borrowerId === borrowerId && fetched.version === version
      ? fetched
      : null;
  const loading = !!borrowerId && current === null;
  const result = current?.result ?? null;

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
