"use client";

import { Button } from "@/components/ui/button";
import type { BinhsScenario } from "@/lib/binhs";
import { BinhsScheduleTable } from "./binhs-schedule-table";

interface Props {
  scenario: BinhsScenario | null;
  paidFlags: boolean[];
  onTogglePaid: (index: number, paid: boolean) => void;
  onMarkAll: (paid: boolean) => void;
  emptyMessage: string;
  busy?: boolean;
}

/** The Custom schedule: staff tick which dues are paid, and the server reworks it. */
export function BinhsCustomTab({ scenario, paidFlags, onTogglePaid, onMarkAll, emptyMessage, busy }: Props) {
  const disabled = paidFlags.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onMarkAll(true)} disabled={disabled}>
          Mark all paid
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onMarkAll(false)} disabled={disabled}>
          Mark all unpaid
        </Button>
        <span className="text-xs text-muted-foreground">
          Toggle the Paid? column on each row to simulate partial delinquency.
          Paid rows settle the chain; unpaid rows compound 20% penalty on
          cumulative unpaid principal.
        </span>
      </div>
      <BinhsScheduleTable
        scenario={scenario}
        paidFlags={paidFlags}
        onTogglePaid={onTogglePaid}
        emptyMessage={emptyMessage}
        busy={busy}
      />
    </div>
  );
}
