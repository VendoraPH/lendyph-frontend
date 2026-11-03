"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { savingsProductService } from "@/services/savings-product.service";
import { SettingsEditor } from "./_components/settings-editor";

function SavingsSettingsContent() {
  const fetcher = useCallback(() => savingsProductService.getSettings(), []);
  const resource = useApiResource(fetcher);

  return (
    <div className="min-w-0 max-w-3xl space-y-6">
      <PageHeader
        title="Savings settings"
        description="Account numbering, interest day count and approval controls for Savings & Deposits."
      />
      <DataState
        resource={resource}
        summary="The savings module's settings: account number format, day-count basis and approvals."
        endpoints={["GET /savings/settings", "PUT /savings/settings"]}
      >
        {/* Keyed on the loaded values so a refetch after saving refills the form. */}
        {(settings) => (
          <SettingsEditor key={JSON.stringify(settings)} initial={settings} onSaved={resource.refetch} />
        )}
      </DataState>
    </div>
  );
}

export default function SavingsSettingsPage() {
  return (
    <RouteGuard permission="savings:settings" pageName="Savings Settings">
      <SavingsSettingsContent />
    </RouteGuard>
  );
}
