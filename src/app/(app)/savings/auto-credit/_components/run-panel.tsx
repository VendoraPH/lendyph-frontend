"use client";

import { useState } from "react";
import { Calculator, Play } from "lucide-react";
import { MethodReferenceFields } from "@/components/common/method-reference-fields";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDateLong, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { AUTO_CREDIT_DEFAULT_METHOD, AUTO_CREDIT_METHOD_OPTIONS, type AutoCreditMethod } from "@/lib/payment-reference";
import { savingsAutoCreditService } from "@/services";
import type { SavingsAutoCreditRunInput, SavingsAutoCreditRunResult } from "@/types/savings-servicing";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { CYCLE_SLOT_LABELS, cycleDateOptions, latestCycle } from "../_lib/cycle-dates";
import { canProcess, processedMessage } from "../_lib/run-view";
import { RunResult } from "./run-result";

/**
 * Preview a cycle's auto-credits (the server plans it and writes nothing),
 * then process it. Each account is credited once per cycle, so a re-run posts
 * nothing; skips come back with their reason in words.
 */
export function RunPanel({ onProcessed }: { onProcessed: () => void }) {
  const today = todayISO();
  const cycles = cycleDateOptions(today);
  const [cycle, setCycle] = useState(() => latestCycle(today) ?? "");
  const [method, setMethod] = useState<AutoCreditMethod>(AUTO_CREDIT_DEFAULT_METHOD);
  const [reference, setReference] = useState("");
  const [request, setRequest] = useState<SavingsAutoCreditRunInput | null>(null);
  const [preview, setPreview] = useState<SavingsAutoCreditRunResult | null>(null);
  const [posted, setPosted] = useState<SavingsAutoCreditRunResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const guard = useSubmitGuard();

  const changed = () => {
    setRequest(null);
    setPreview(null);
  };

  const runPreview = () => {
    if (!cycle) return;
    const body: SavingsAutoCreditRunInput = {
      cycle_date: cycle,
      method,
      ...(reference.trim() ? { reference_number: reference.trim() } : {}),
    };
    setPreviewing(true);
    setPreview(null);
    setPosted(null);
    savingsAutoCreditService
      .preview(body)
      .then((result) => {
        setRequest(body);
        setPreview(result);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't preview this cycle's auto-credits."))
      .then(() => setPreviewing(false));
  };

  const process = () => {
    if (!request) return;
    guard
      .run((key) => savingsAutoCreditService.process(request, key))
      ?.then((result) => {
        const message = processedMessage(result);
        notifySuccess(message.title, message.description);
        setPosted(result);
        setRequest(null);
        setPreview(null);
        onProcessed();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't process the auto-credit run."));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run auto-credit</CardTitle>
        <CardDescription>
          Pick the cycle and the settlement account the money came in through. Preview first; every credit posts
          today&apos;s date, and an account is credited once a cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <FormField id="ac-cycle" label="Cycle" hint="A 15th or a month end, up to 92 days ago.">
            <OptionSelect
              id="ac-cycle"
              value={cycle}
              onChange={(v) => {
                setCycle(v);
                changed();
              }}
              options={cycles.map((c) => ({ value: c.value, label: `${formatDateLong(c.value)} · ${CYCLE_SLOT_LABELS[c.slot]}` }))}
              placeholder="Choose a cycle"
            />
          </FormField>
          <MethodReferenceFields
            idPrefix="ac-run"
            methodLabel="Settlement Account"
            options={AUTO_CREDIT_METHOD_OPTIONS}
            method={method}
            reference={reference}
            onChange={(next) => {
              setMethod(next.method);
              setReference(next.reference);
              changed();
            }}
            referenceRequired={false}
            problem={null}
            disabled={previewing || guard.submitting}
            className="grid gap-4 sm:grid-cols-2 lg:col-span-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runPreview} disabled={previewing || !cycle}>
            <Calculator className="h-4 w-4" />
            {previewing ? "Previewing…" : "Preview"}
          </Button>
          {preview && (
            <PermissionButton
              permission="savings:post"
              onClick={process}
              disabled={guard.submitting || !canProcess(preview)}
            >
              <Play className="h-4 w-4" />
              {guard.submitting ? "Processing…" : "Process run"}
            </PermissionButton>
          )}
        </div>
        {preview && <RunResult result={preview} posted={false} />}
        {posted && <RunResult result={posted} posted />}
      </CardContent>
    </Card>
  );
}
