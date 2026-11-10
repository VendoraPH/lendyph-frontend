"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { savingsService } from "@/services";
import { ApprovalSettingsCard } from "./approval-settings-card";
import { BooksCard } from "./books-card";
import { TaxRulesCard } from "./tax-rules-card";

/**
 * Savings settings: the approval amounts, dormancy and the large-transaction
 * alert, and the append-only tax rules on deposit interest. Ported from set
 * A's settings editor (#500), on design §2's fields.
 */
export function SettingsScreen() {
  const fetcher = useCallback(() => savingsService.settings(), []);
  const resource = useApiResource(fetcher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings Settings</h1>
        <p className="text-sm text-muted-foreground">
          When a withdrawal or payout needs approval, when an account turns dormant, and the tax on deposit interest.
        </p>
      </div>
      <DataState
        resource={resource}
        endpoints={["GET /savings/settings"]}
        summary="The savings settings will show here once the savings service is connected."
      >
        {(settings) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <BooksCard settings={settings} onPrepared={() => resource.refetch()} />
            <ApprovalSettingsCard settings={settings} onSaved={() => resource.refetch()} />
            <TaxRulesCard settings={settings} onAdded={() => resource.refetch()} />
          </div>
        )}
      </DataState>
    </div>
  );
}
