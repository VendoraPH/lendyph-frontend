"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { portalService } from "@/services/portal.service";
import type { PortalSavingsAccount } from "@/types/portal";
import { LedgerTable } from "../../../_components/ledger-table";

export function SavingsLedgerCard({ account }: { account: PortalSavingsAccount }) {
  const fetcher = useCallback(() => portalService.savingsLedger(account.id), [account.id]);
  const resource = useApiResource(fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transactions · {account.account_number}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/savings/{id}/transactions"]}
          summary="Deposits, withdrawals and interest credited to this account."
        >
          {(rows) => <LedgerTable entries={rows} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
