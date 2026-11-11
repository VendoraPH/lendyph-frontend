"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CdaPeriod } from "@/types/cda";

/**
 * CDA's extension for one year's annual reports, with its reference (carried
 * over from #510 by Augustin). The server checks it falls after the default
 * deadline; mediation keeps its own deadlines.
 */
export function ExtensionForm({ period, onSaved }: { period: CdaPeriod; onSaved: () => void }) {
  const { can } = usePermission();
  const [date, setDate] = useState(period.extended_deadline ?? "");
  const [reference, setReference] = useState(period.extension_reference ?? "");
  const [busy, setBusy] = useState(false);
  const disabled = busy || !can("cda:settings");

  function save(next: string | null) {
    if (next !== null && !reference.trim()) {
      notifyValidation(["Reference (memorandum circular or letter)"]);
      return;
    }
    setBusy(true);
    cdaService
      .setExtension(period.year, next, next === null ? null : reference.trim())
      .then((saved) => {
        setDate(saved.extended_deadline ?? "");
        setReference(saved.extension_reference ?? "");
        notifySuccess(next ? "Extension recorded" : "Extension removed");
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "Could not save the extension"))
      .finally(() => setBusy(false));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{period.year} deadline extension</CardTitle>
        <CardDescription>
          Default deadline {formatDate(period.default_deadline)}; now due {formatDate(period.effective_deadline)}. Set only when
          CDA granted an extension.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="cda-extension">Extended to</Label>
            <Input id="cda-extension" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-extension-ref">Reference</Label>
            <Input
              id="cda-extension-ref"
              placeholder="e.g. MC No. 2027-01"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={disabled}
            />
          </div>
          <PermissionButton permission="cda:settings" onClick={() => (date ? save(date) : notifyValidation(["Extended to"]))} disabled={busy}>
            Save extension
          </PermissionButton>
          {period.extended_deadline && (
            <PermissionButton permission="cda:settings" variant="outline" onClick={() => save(null)} disabled={busy}>
              Remove
            </PermissionButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
