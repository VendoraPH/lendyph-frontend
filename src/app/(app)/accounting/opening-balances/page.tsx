"use client";

import { useCallback, useState } from "react";
import { Building2, RefreshCw } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource, usePermission } from "@/hooks";
import { accountingService } from "@/services";
import type { OpeningBalance } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { openingBalanceStatusLabel } from "../_lib/display-labels";
import { OpeningBalanceEditor } from "./_components/opening-balance-editor";
import { OpeningBalanceReadOnly } from "./_components/opening-balance-read-only";
import { accessNotice, viewFor } from "./_lib/opening-balances";

const DESCRIPTION = "The balances the books start from, entered once for the whole organisation.";

function OpeningBalancesContent() {
  const { can } = usePermission();
  const canViewAllBranches = can("branches:view_all");
  const notice = accessNotice(canViewAllBranches);

  // The server answers 403 without access to every branch, so don't ask.
  const fetcher = useCallback(() => accountingService.openingBalances(), []);
  const resource = useAccountingResource<OpeningBalance>(fetcher, canViewAllBranches);

  // A save or finalise answers with the whole entry; it replaces the loaded one
  // until a reload. Each answer remounts the editor from the server's lines.
  const [latest, setLatest] = useState<OpeningBalance | null>(null);
  const [generation, setGeneration] = useState(0);
  // The server's message after a refusal that reloaded the entry.
  const [refusal, setRefusal] = useState<string | null>(null);

  const answer = (opening: OpeningBalance) => {
    setLatest(opening);
    setRefusal(null);
    setGeneration((n) => n + 1);
  };

  const reload = (message: string | null) => {
    setLatest(null);
    setRefusal(message);
    setGeneration((n) => n + 1);
    resource.refetch();
  };

  const current = latest ?? resource.data;

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Opening Balances"
        description={DESCRIPTION}
        actions={
          current && (
            <Badge variant="outline">{openingBalanceStatusLabel(current.status)}</Badge>
          )
        }
      />

      {notice ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="max-w-lg text-sm text-muted-foreground">{notice}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {refusal && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{refusal} The opening balances were reloaded from the server.</span>
              <Button size="sm" variant="outline" onClick={() => reload(null)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload
              </Button>
            </div>
          )}

          <DataState
            resource={{ ...resource, data: current }}
            summary="The organisation's opening balances: a draft, its totals, and the journal it posts."
            endpoints={[
              "GET /accounting/opening-balances",
              "PUT /accounting/opening-balances",
              "POST /accounting/opening-balances/finalise",
            ]}
          >
            {(opening) => (
              <Card>
                <CardContent className="pt-6">
                  {viewFor(opening) === "edit" ? (
                    <OpeningBalanceEditor
                      key={generation}
                      opening={opening}
                      onAnswer={answer}
                      onReload={reload}
                    />
                  ) : (
                    <OpeningBalanceReadOnly opening={opening} />
                  )}
                </CardContent>
              </Card>
            )}
          </DataState>
        </>
      )}
    </div>
  );
}

export default function OpeningBalancesPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Opening Balances">
      <OpeningBalancesContent />
    </RouteGuard>
  );
}
