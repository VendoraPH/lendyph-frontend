"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { StatusPill } from "@/components/portal/status-pill";
import { isNilAmount } from "@/lib/savings/amount-text";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NONE, SAVINGS_STATUS, SAVINGS_STATUS_TONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";

/**
 * The member's savings accounts. "Can withdraw now" is the server's
 * `withdrawable` (its available balance on an active account, with holds,
 * pending requests and the maintaining balance already taken off); the
 * browser never works it out.
 */
export function SavingsAccounts() {
  const fetcher = useCallback(() => portalService.savings(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your savings. Please try again.");

  return (
    <section aria-labelledby="savings-accounts">
      <h2 id="savings-accounts" className="mb-3 text-base font-semibold">
        Savings accounts
      </h2>
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.length === 0} emptyText="You have no savings accounts.">
        <ul className="grid gap-3 md:grid-cols-2">
          {data?.map((account) => (
            <li key={account.id}>
              <Card size="sm">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/member/savings/${account.id}`} className="font-semibold break-words hover:underline">
                        {account.account_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{account.product_name ?? NONE}</p>
                    </div>
                    <StatusPill value={account.status} labels={SAVINGS_STATUS} tones={SAVINGS_STATUS_TONE} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Balance</dt>
                      <dd className="font-semibold">
                        <Money value={account.ledger_balance} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Can withdraw now</dt>
                      <dd>
                        <Money value={account.withdrawable} />
                      </dd>
                    </div>
                    {!isNilAmount(account.pending_withdrawal) && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Pending withdrawal</dt>
                        <dd>
                          <Money value={account.pending_withdrawal} />
                        </dd>
                      </div>
                    )}
                    {!isNilAmount(account.held) && (
                      <div>
                        <dt className="text-xs text-muted-foreground">On hold</dt>
                        <dd>
                          <Money value={account.held} />
                        </dd>
                      </div>
                    )}
                  </dl>
                  <Link href={`/member/savings/${account.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Passbook and statement
                    <span className="sr-only"> for {account.account_number}</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </LoadState>
    </section>
  );
}
