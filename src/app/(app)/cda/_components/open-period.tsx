"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cdaService } from "@/services";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { useCdaYearPicker } from "../_hooks/use-cda-year-picker";
import { parseYear } from "../_lib/year";

/**
 * Open a calendar year's reporting period (`cda:prepare`). The server creates
 * one report per type and half with its template and deadline; a year that is
 * already open answers 409, in words.
 */
export function OpenPeriodForm({ onOpened, compact = false }: { onOpened: () => void; compact?: boolean }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  // The opened year shows next, and a link's ?year= no longer wins over it.
  const pickYear = useCdaYearPicker();

  function open() {
    const year = parseYear(raw);
    if (year === null) {
      notifyValidation(["Year (four digits, such as 2026)"]);
      return;
    }
    setBusy(true);
    cdaService
      .openPeriod(year)
      .then((period) => {
        notifySuccess(`${period.year} reporting period opened`);
        pickYear(period.year);
        setRaw("");
        onOpened();
      })
      .catch((err: unknown) => notifyError(err, "Could not open the reporting period"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className={compact ? "space-y-1" : "space-y-2"}>
        <Label htmlFor="cda-open-year" className={compact ? "text-xs" : undefined}>
          Year to open
        </Label>
        <Input
          id="cda-open-year"
          inputMode="numeric"
          placeholder="e.g. 2026"
          className="w-28"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>
      <PermissionButton permission="cda:prepare" size="sm" onClick={open} disabled={busy}>
        <CalendarPlus className="mr-1 h-4 w-4" />
        {busy ? "Opening…" : "Open reporting period"}
      </PermissionButton>
    </div>
  );
}
