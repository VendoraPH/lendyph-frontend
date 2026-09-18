"use client";

import { RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useChartOfAccounts } from "@/hooks";
import { AccountingPageHeader } from "../_components/page-header";
import { ChartOfAccountsTable } from "./_components/chart-of-accounts-table";
import { SeedChartCard } from "./_components/seed-chart-card";

export default function ChartOfAccountsPage() {
  // The module's existing hook rather than a fetch of its own: it drains every
  // page (the chart is 50-odd rows against a default page size of 15) and
  // already falls back to the template when there is nothing saved yet.
  const { accounts, loading, isTemplate, notBuiltYet, truncated, total, refetch } =
    useChartOfAccounts();

  return (
    <RouteGuard permission="chart_of_accounts:view" pageName="Chart of Accounts">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Chart of Accounts"
          description="The account tree every journal entry posts into."
        />

        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Spinner className="h-6 w-6" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/*
              Offered only while the chart is still the template AND the list
              endpoint merely has nothing to give — never on the back of a
              failed request, which says nothing about whether a chart exists.
              Renders nothing without `chart_of_accounts:create`.
            */}
            {isTemplate && (
              <SeedChartCard notBuiltYet={notBuiltYet} onSeeded={refetch} />
            )}

            <Card>
              <CardContent className="space-y-4 pt-6">
                {isTemplate && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <span className="font-medium">Default template.</span>{" "}
                    <span className="text-muted-foreground">
                      This is the chart a new organisation is seeded with. It is
                      not yet saved to your organisation, so it cannot be edited
                      and no entry can be posted against it.
                    </span>
                  </div>
                )}

                {truncated && (
                  <IncompleteListNotice
                    shown={accounts.length}
                    total={total}
                    noun="accounts"
                    consequence="An account missing from this table is also missing from every picker in the module."
                  />
                )}

                <ChartOfAccountsTable accounts={accounts} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
