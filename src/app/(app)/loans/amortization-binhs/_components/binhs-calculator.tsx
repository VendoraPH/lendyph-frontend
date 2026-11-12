"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteGuard } from "@/components/common";
import { getErrorMessage } from "@/lib/api-error";
import { formatDateISO } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import {
  binhsRequest,
  inputFromPrefill,
  paidFlagsFor,
  type BinhsInput,
  type BinhsResult,
} from "@/lib/binhs";
import { binhsPrefill, calculateBinhs } from "../_lib/binhs-api";
import { BinhsInputForm } from "./binhs-input-form";
import { BinhsScheduleTable } from "./binhs-schedule-table";
import { BinhsCustomTab } from "./binhs-custom-tab";

/** Typing pauses this long before the server is asked again. */
const RECALCULATE_AFTER_MS = 400;

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return formatDateISO(d);
}

const DEFAULT_INPUT: BinhsInput = {
  principal: "10000",
  annualRate: "24",
  termMonths: "6",
  scbuPerPeriod: "100",
  startDate: defaultStartDate(),
};

/** The server's answer and the request it answers, so a stale one is known. */
interface Answer {
  key: string;
  scenarios: BinhsResult["scenarios"];
  error: string | null;
}

function BinhsPageContent() {
  const params = useSearchParams();
  const loanId = params.get("loan_id");
  const [input, setInput] = useState<BinhsInput>(DEFAULT_INPUT);
  const [paid, setPaid] = useState<Record<number, boolean>>({});
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  // `?loan_id`: the server's prefill, its rate already a rate a year. Until it
  // answers, nothing is calculated, so the defaults never flash a schedule.
  useEffect(() => {
    if (!loanId || prefilledFor === loanId) return;
    let cancelled = false;
    binhsPrefill(Number(loanId))
      .then((prefill) => {
        if (cancelled) return;
        if (prefill) setInput((current) => inputFromPrefill(prefill, current));
        setPrefilledFor(loanId);
      })
      .catch((err) => {
        if (cancelled) return;
        notifyError(err, "We couldn't load that loan's figures. Enter the inputs instead.");
        setPrefilledFor(loanId);
      });
    return () => {
      cancelled = true;
    };
  }, [loanId, prefilledFor]);

  const termMonths = Number(input.termMonths);
  const paidFlags = useMemo(() => paidFlagsFor(termMonths, paid), [termMonths, paid]);
  const waitingForPrefill = loanId !== null && prefilledFor !== loanId;
  const request = useMemo(
    () => (waitingForPrefill ? null : binhsRequest(input, paidFlags)),
    [waitingForPrefill, input, paidFlags],
  );
  const requestKey = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!request || requestKey === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      calculateBinhs(request, controller.signal)
        .then((result) => setAnswer({ key: requestKey, scenarios: result.scenarios, error: null }))
        .catch((err) => {
          if (controller.signal.aborted) return;
          setAnswer({
            key: requestKey,
            scenarios: null,
            error: getErrorMessage(err, "We couldn't build the schedules. Check the inputs and try again."),
          });
        });
    }, RECALCULATE_AFTER_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, requestKey]);

  const busy = requestKey !== null && answer?.key !== requestKey;
  // The last answer stays on screen, dimmed, while a newer one is worked out.
  const scenarios = requestKey === null ? null : answer?.scenarios ?? null;
  const error = !busy ? answer?.error ?? null : null;
  const emptyMessage = waitingForPrefill
    ? "Loading the loan's figures…"
    : requestKey === null
      ? "Enter the principal, annual rate, a term of 1 to 60 months and the first due date."
      : busy
        ? "Working out the schedule…"
        : "No schedule to show.";

  const togglePaid = (index: number, value: boolean) => setPaid((prev) => ({ ...prev, [index]: value }));
  const markAll = (value: boolean) =>
    setPaid(Object.fromEntries(paidFlags.map((_, i) => [i, value])));

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Amortization (BINHS)</CardTitle>
          <CardDescription>
            BINHS computation compounds penalty and prior unpaid principal when
            a due is left unpaid for more than 30 days. Penalty is 20% of the
            cumulative unpaid principal; interest and penalty are added to the
            outstanding balance. Switch tabs to view the Ideal schedule,
            Worst Case (no dues paid), or Custom (toggle which dues are paid).
            Every figure is worked out by the server.
          </CardDescription>
        </CardHeader>
      </Card>

      <BinhsInputForm value={input} onChange={setInput} />

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="ideal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ideal">Ideal</TabsTrigger>
          <TabsTrigger value="worst">Worst Case</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        <TabsContent value="ideal">
          <BinhsScheduleTable scenario={scenarios?.ideal ?? null} emptyMessage={emptyMessage} busy={busy} />
        </TabsContent>
        <TabsContent value="worst">
          <BinhsScheduleTable scenario={scenarios?.worst_case ?? null} emptyMessage={emptyMessage} busy={busy} />
        </TabsContent>
        <TabsContent value="custom">
          <BinhsCustomTab
            scenario={scenarios?.custom ?? null}
            paidFlags={paidFlags}
            onTogglePaid={togglePaid}
            onMarkAll={markAll}
            emptyMessage={emptyMessage}
            busy={busy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BinhsCalculator() {
  return (
    <RouteGuard permission="loans:view" pageName="Amortization BINHS">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
        <BinhsPageContent />
      </Suspense>
    </RouteGuard>
  );
}
