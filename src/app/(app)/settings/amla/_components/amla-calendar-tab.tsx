"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiResource, usePermission } from "@/hooks";
import { amlaApi } from "@/lib/amla/api";
import { amlaCalendarHeadline, amlaYearChoices } from "@/lib/amla/settings-view";
import { useAuthStore } from "@/store";
import type { AmlaCalendar } from "@/types/amla";
import { AmlaCalendarDayDialog } from "./amla-calendar-day-dialog";
import { AmlaCalendarEntries } from "./amla-calendar-entries";
import { AmlaChangeRequestList } from "./amla-change-request-list";
import { amlaDecisionAction } from "./amla-decisions";
import { AmlaDeadlinePreviewCard } from "./amla-deadline-preview-card";
import { AmlaNoteDialog, type AmlaNoteAction } from "./amla-note-dialog";

/**
 * The working-day calendar that report deadlines count on (holidays, AMLC
 * non-reporting days and facility suspensions), and a deadline preview.
 * `canAsk`: AMLA settings holders with every branch ask for changes and decide
 * the year's waiting ones.
 */
export function AmlaCalendarTab({ canAsk }: { canAsk: boolean }) {
  const [year, setYear] = useState<number | null>(null);
  const fetcher = useCallback(() => amlaApi.calendar(year), [year]);
  const resource = useApiResource(fetcher);

  return (
    <>
      <DataState resource={resource} summary="The AMLA working-day calendar for a year." endpoints={["GET /amla/calendar"]}>
        {(calendar) => <CalendarCard calendar={calendar} canAsk={canAsk} onYear={setYear} onChanged={resource.refetch} />}
      </DataState>
      <AmlaDeadlinePreviewCard />
    </>
  );
}

interface CalendarCardProps {
  calendar: AmlaCalendar;
  canAsk: boolean;
  onYear: (year: number) => void;
  onChanged: () => void;
}

function CalendarCard({ calendar, canAsk, onYear, onChanged }: CalendarCardProps) {
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState<AmlaNoteAction | null>(null);
  const { can } = usePermission();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const pending = calendar.pending ?? [];

  function confirmYear() {
    setAction({
      title: `Ask to confirm the ${calendar.year} calendar?`,
      description: `Once another AMLA settings holder approves, deadlines that reach ${calendar.year} are no longer provisional.`,
      label: "Reason",
      required: true,
      confirmLabel: "Ask for approval",
      success: "Change asked for",
      failure: "The change couldn't be asked for.",
      run: (reason) => amlaApi.ask({ type: "calendar_confirm_year", year: calendar.year, reason: reason.trim() }),
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            Working-day calendar
            <Badge variant={calendar.confirmed ? "outline" : "secondary"}>{calendar.confirmed ? "Confirmed" : "Provisional"}</Badge>
          </CardTitle>
          <CardDescription>{amlaCalendarHeadline(calendar)}</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="amla-calendar-year">Year</Label>
            <NativeSelect id="amla-calendar-year" value={String(calendar.year)} onChange={(e) => onYear(Number(e.target.value))}>
              {amlaYearChoices(calendar.year).map((y) => (
                <NativeSelectOption key={y} value={String(y)}>
                  {y}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {canAsk && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              Ask to add a day
            </Button>
          )}
          {canAsk && !calendar.confirmed && (
            <Button size="sm" onClick={confirmYear}>
              Ask to confirm {calendar.year}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <AmlaCalendarEntries entries={calendar.entries} canAsk={canAsk} onAsk={setAction} />
        {canAsk && pending.length > 0 && (
          <section aria-labelledby="amla-calendar-waiting" className="space-y-2">
            <h3 id="amla-calendar-waiting" className="text-sm font-medium">
              Waiting for approval
            </h3>
            <AmlaChangeRequestList
              compact
              requests={pending}
              userId={userId}
              can={can}
              onDecide={(request, decision) => setAction(amlaDecisionAction(request, decision))}
            />
          </section>
        )}
      </CardContent>
      {canAsk && (
        <AmlaCalendarDayDialog
          open={adding}
          onClose={() => setAdding(false)}
          onAsked={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
      <AmlaNoteDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          onChanged();
        }}
      />
    </Card>
  );
}
