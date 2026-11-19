"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { amlaCddApi } from "@/lib/amla/cdd-api";
import { AMLA_RISK_LEVEL_OPTIONS, amlaAssessBody } from "@/lib/amla/cdd-view";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaRiskAssessment } from "@/types/amla-cdd";
import { CddFormDialog } from "./cdd-form-dialog";

interface Props {
  open: boolean;
  current: AmlaRiskAssessment | null;
  subject: AmlaSubjectRef;
  onClose: () => void;
  onAssessed: () => void;
}

/** Assess now under the rules in force, or override the level with a reason. An override stands until the computed level changes. */
export function RiskAssessDialog({ open, current, subject, onClose, onAssessed }: Props) {
  const [level, setLevel] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, current)) {
    setLevel("");
    setReason("");
    setError(null);
  }

  function submit() {
    const result = amlaAssessBody({ level, reason });
    if ("error" in result) return setError(result.error);
    run(() => amlaCddApi.assess(subject, result.body))
      ?.then(() => {
        notifySuccess(result.body.override_level ? "Risk level overridden" : "Risk assessed");
        onAssessed();
      })
      .catch((err: unknown) => notifyError(err, "The risk assessment couldn't be recorded."));
  }

  return (
    <CddFormDialog
      open={open}
      title="Assess the AML risk"
      description={
        current
          ? `The rules in force give ${current.computed_level_words}. Leave the level empty to assess again under the rules in force, or pick one to override it.`
          : "Leave the level empty to assess under the rules in force, or pick one to override it."
      }
      submitLabel={level === "" ? "Assess now" : "Override"}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="cdd-override-level">Override the level</Label>
        <NativeSelect
          id="cdd-override-level"
          value={level}
          disabled={submitting}
          onChange={(e) => {
            setLevel(e.target.value);
            setError(null);
          }}
        >
          <NativeSelectOption value="">No override</NativeSelectOption>
          {AMLA_RISK_LEVEL_OPTIONS.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cdd-override-reason">
          Reason{level === "" && <span className="text-muted-foreground"> (needed only with an override)</span>}
        </Label>
        <Textarea
          id="cdd-override-reason"
          value={reason}
          maxLength={1000}
          disabled={submitting}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
        />
      </div>
    </CddFormDialog>
  );
}
