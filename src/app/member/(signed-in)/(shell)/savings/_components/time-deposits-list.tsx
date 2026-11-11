"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { TIME_DEPOSIT_STATUS, TIME_DEPOSIT_STATUS_TONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { plural, rateText } from "@/lib/portal/words";

/** The member's time deposits, newest placement first, with the server's figures. */
export function TimeDepositsList() {
  const fetcher = useCallback(() => portalService.timeDeposits(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your time deposits. Please try again.");

  return (
    <section aria-labelledby="time-deposits-heading" id="time-deposits" className="scroll-mt-20">
      <h2 id="time-deposits-heading" className="mb-3 text-base font-semibold">
        Time deposits
      </h2>
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.length === 0} emptyText="You have no time deposits.">
        <ul className="grid gap-3 md:grid-cols-2">
          {data?.map((td) => (
            <li key={td.id}>
              <Card size="sm">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/member/time-deposits/${td.id}`} className="font-semibold break-words hover:underline">
                      {td.certificate_number}
                    </Link>
                    <StatusPill value={td.status} labels={TIME_DEPOSIT_STATUS} tones={TIME_DEPOSIT_STATUS_TONE} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Placed</dt>
                      <dd className="font-semibold">
                        <Money value={td.principal} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">At maturity</dt>
                      <dd>
                        <Money value={td.maturity_amount} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Rate</dt>
                      <dd>{rateText(td.annual_rate)} a year</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Matures on</dt>
                      <dd>
                        {formatDate(td.maturity_date)}
                        {td.days_remaining !== null && (
                          <span className={td.maturing_soon ? "block text-xs text-amber-700 dark:text-amber-400" : "block text-xs text-muted-foreground"}>
                            {plural(td.days_remaining, "day")} left
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </LoadState>
    </section>
  );
}
