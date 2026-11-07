"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaReportingPeriod } from "@/types/cda";
import { useCdaYear } from "../../_hooks/use-cda-year";

function ExtensionEditor({ period }: { period: CdaReportingPeriod }) {
  const [value, setValue] = useState(period.extended_deadline ?? "");
  const [busy, setBusy] = useState(false);

  function save(next: string | null) {
    setBusy(true);
    cdaService
      .setExtendedDeadline(period.year, next)
      .then((saved) => {
        setValue(saved.extended_deadline ?? "");
        notifySuccess(next ? "Extension recorded" : "Extension cleared");
      })
      .catch((err: unknown) => notifyError(err, "Could not save the extension"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="cda-extension">Extended to</Label>
        <Input
          id="cda-extension"
          type="date"
          min={period.default_deadline}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
        />
      </div>
      <PermissionButton permission="cda:settings" onClick={() => save(value || null)} disabled={busy}>
        Save extension
      </PermissionButton>
      {period.extended_deadline && (
        <PermissionButton permission="cda:settings" variant="outline" onClick={() => save(null)} disabled={busy}>
          Clear
        </PermissionButton>
      )}
      <p className="basis-full text-xs text-muted-foreground">Default deadline: {formatDate(period.default_deadline)}</p>
    </div>
  );
}

/** A CDA memorandum can extend one year's deadline; this records it for the selected year. */
export function ExtensionForm() {
  const year = useCdaYear();
  const resource = useApiResource(
    useCallback(() => cdaService.listPeriods().then((ps) => ps.find((p) => p.year === year) ?? null), [year]),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">FY {year} deadline extension</CardTitle>
        <CardDescription>Set only when CDA granted an extension for this reporting year.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.PERIODS}`, `PATCH ${API_ENDPOINTS.CDA.PERIOD(year)}`]}
          summary={`The FY ${year} reporting period`}
          isEmpty={(p) => p === null}
          emptyMessage={`FY ${year} is not open yet. Open it from the CDA dashboard.`}
        >
          {(period) => period && <ExtensionEditor key={period.year} period={period} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
