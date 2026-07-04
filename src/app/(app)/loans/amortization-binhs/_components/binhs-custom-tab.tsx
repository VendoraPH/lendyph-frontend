"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildCustomSchedule,
  isValidBinhsInput,
  type BinhsInput,
} from "@/lib/binhs";
import { BinhsScheduleTable } from "./binhs-schedule-table";

export function BinhsCustomTab({ input }: { input: BinhsInput }) {
  const valid = isValidBinhsInput(input);
  const [paidMap, setPaidMap] = useState<Record<number, boolean>>({});

  const paidFlags = useMemo(() => {
    const n = valid ? input.termMonths : 0;
    return Array.from({ length: n }, (_, i) => paidMap[i] ?? false);
  }, [paidMap, input.termMonths, valid]);

  const rows = useMemo(
    () => buildCustomSchedule(input, paidFlags),
    [input, paidFlags],
  );

  const togglePaid = (index: number, paid: boolean) =>
    setPaidMap((prev) => ({ ...prev, [index]: paid }));

  const markAll = (paid: boolean) => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < input.termMonths; i++) next[i] = paid;
    setPaidMap(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => markAll(true)}
          disabled={!valid}
        >
          Mark all paid
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => markAll(false)}
          disabled={!valid}
        >
          Mark all unpaid
        </Button>
        <span className="text-xs text-muted-foreground">
          Toggle the Paid? column on each row to simulate partial delinquency.
          Paid rows settle the chain; unpaid rows compound 20% penalty on
          cumulative unpaid principal.
        </span>
      </div>
      <BinhsScheduleTable
        rows={rows}
        paidFlags={paidFlags}
        onTogglePaid={togglePaid}
      />
    </div>
  );
}
