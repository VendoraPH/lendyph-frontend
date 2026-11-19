"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource, usePermission } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaAlertActions } from "@/lib/amla/monitoring-access";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaAlertHistoryLine, amlaAlertStepNote, amlaCloseReasonBody } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import { amlaStepConflict } from "@/lib/amla/record-read";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/store";
import type { AmlaAlertDetail, AmlaAlertHistoryStep, AmlaAlertRow } from "@/types/amla-monitoring";
import { CddFormDialog } from "../customers/_components/cdd-form-dialog";

type Step = "assign" | "review" | "close";

interface StepText {
  title: string;
  description: string;
  label: string;
  submit: string;
  success: string;
  failure: string;
}

const TEXT: Readonly<Record<Step, StepText>> = {
  assign: {
    title: "Assign this alert to you?",
    description: "You become the person working it. AMLA's inbox names only its reference and priority.",
    label: "Note (optional)",
    submit: "Assign to me",
    success: "Alert assigned to you",
    failure: "The alert couldn't be assigned.",
  },
  review: {
    title: "Start reviewing this alert?",
    description: "It reads Under review until it is escalated to a case or closed.",
    label: "Note (optional)",
    submit: "Start review",
    success: "Review started",
    failure: "The review couldn't be started.",
  },
  close: {
    title: "Close this alert?",
    description: "Say why it needs no case. The reason is kept with the alert's history, and later activity raises a new alert.",
    label: "Reason",
    submit: "Close alert",
    success: "Alert closed",
    failure: "The alert couldn't be closed.",
  },
};

interface WorkflowProps {
  alert: AmlaAlertDetail;
  onChanged: (row: AmlaAlertRow) => void;
  /** A 409: the dialog closes, and the page reads the alert again and keeps the server's words. */
  onConflict: (message: string) => void;
}

/** Assign to me, start review and close, as the server allows them; each answers the alert's row. */
export function AlertWorkflow({ alert, onChanged, onConflict }: WorkflowProps) {
  const { can } = usePermission();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const actions = amlaAlertActions(alert, userId, can);
  const [step, setStep] = useState<Step | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(step !== null, step)) {
    setText("");
    setError(null);
  }
  const buttons: [Step, string, boolean][] = [
    ["assign", "Assign to me", actions.assignToMe],
    ["review", "Start review", actions.review],
    ["close", "Close with a reason", actions.close],
  ];

  function submit() {
    if (step === null) return;
    const result = step === "close" ? amlaCloseReasonBody(text) : amlaAlertStepNote(text);
    if ("error" in result) return setError(result.error);
    const words = TEXT[step];
    const request = () => {
      if (step === "close") return amlaMonitoringApi.closeAlert(alert.id, result.body);
      if (step === "review") return amlaMonitoringApi.reviewAlert(alert.id, result.body);
      return amlaMonitoringApi.assignAlert(alert.id, userId ?? 0, result.body);
    };
    run(request)
      ?.then((row) => {
        notifySuccess(words.success);
        setStep(null);
        onChanged(row);
      })
      .catch((err: unknown) => {
        const conflict = amlaStepConflict(err);
        if (conflict === null) return notifyError(err, words.failure);
        setStep(null);
        onConflict(conflict);
      });
  }

  const shown = buttons.filter(([, , allowed]) => allowed);
  const words = step === null ? null : TEXT[step];
  return (
    <>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shown.map(([key, label]) => (
            <Button key={key} size="sm" variant={key === "close" ? "outline" : "default"} onClick={() => setStep(key)}>
              {label}
            </Button>
          ))}
        </div>
      )}
      <CddFormDialog
        open={step !== null}
        title={words?.title ?? ""}
        description={words?.description ?? ""}
        submitLabel={words?.submit ?? ""}
        submitting={submitting}
        error={error}
        onClose={() => setStep(null)}
        onSubmit={submit}
      >
        <div className="space-y-1">
          <Label htmlFor="amla-alert-step-text">{words?.label}</Label>
          <Textarea
            id="amla-alert-step-text"
            value={text}
            maxLength={2000}
            disabled={submitting}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
        </div>
      </CddFormDialog>
    </>
  );
}

const NONE = () => Promise.resolve<AmlaAlertHistoryStep[]>([]);

/** The alert's workflow history: logged by the server, so read only when asked for, once per "Show history". */
export function AlertHistoryCard({ alertId }: { alertId: number }) {
  const [fetcher, setFetcher] = useState<(() => Promise<AmlaAlertHistoryStep[]>) | null>(null);
  const history = useApiResource(fetcher ?? NONE, fetcher !== null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Workflow history</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setFetcher(() => once(() => amlaMonitoringApi.alertHistory(alertId)))}>
          {fetcher === null ? "Show history" : "Show again"}
        </Button>
      </CardHeader>
      <CardContent className="text-sm">
        {fetcher === null && <p className="text-muted-foreground">Each step, who took it and its note or reason.</p>}
        {fetcher !== null && history.loading && <p className="text-muted-foreground">Loading…</p>}
        {fetcher !== null && history.error && <p className="text-destructive">{history.error}</p>}
        {fetcher !== null && history.data && history.data.length === 0 && <p className="text-muted-foreground">No steps yet.</p>}
        {fetcher !== null && history.data && history.data.length > 0 && (
          <ol className="space-y-2">
            {history.data.map((entry) => (
              <li key={entry.id} className="rounded-md border p-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{amlaAlertHistoryLine(entry).title}</span>
                  <span className="text-muted-foreground">
                    {entry.by?.name ?? "System"} · {entry.at ? formatDateTime(entry.at) : "—"}
                  </span>
                </div>
                {entry.note && <p className="mt-1 whitespace-pre-wrap">{amlaAlertHistoryLine(entry).note}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
