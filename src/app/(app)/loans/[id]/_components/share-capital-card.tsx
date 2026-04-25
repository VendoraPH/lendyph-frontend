"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Landmark, ChevronDown, Loader2, ExternalLink } from "lucide-react";
import { shareCapitalService } from "@/services";
import type { ShareCapitalLedgerEntry } from "@/types";

interface ShareCapitalCardProps {
  borrowerId: number | null | undefined;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ShareCapitalCard({ borrowerId }: ShareCapitalCardProps) {
  const [entries, setEntries] = useState<ShareCapitalLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!borrowerId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    shareCapitalService
      .ledgerList({ borrower_id: borrowerId, per_page: 9999 })
      .then((res) => {
        if (cancelled) return;
        const items =
          (res as { data?: ShareCapitalLedgerEntry[] }).data ??
          (res as unknown as ShareCapitalLedgerEntry[]);
        setEntries(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [borrowerId]);

  const balance = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const e of entries) {
      if (e.type === "credit") credits += e.amount;
      else debits += e.amount;
    }
    return credits - debits;
  }, [entries]);

  return (
    <Collapsible defaultOpen={false}>
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
            ) : error ? (
              <p className="text-xs text-muted-foreground">
                Could not load share capital.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="text-lg font-semibold text-brand-orange tabular-nums">
                    {formatCurrency(balance)}
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
