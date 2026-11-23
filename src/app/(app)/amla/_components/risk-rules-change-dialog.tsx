"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaApi } from "@/lib/amla/api";
import { amlaRiskChangeBody, amlaRiskDraft, amlaRiskRulesView, type AmlaRiskDraft } from "@/lib/amla/monitoring-view";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaRiskRules } from "@/types/amla-monitoring";

interface Props {
  open: boolean;
  rules: AmlaRiskRules;
  onClose: () => void;
  onAsked: () => void;
}

/** Ask for the next risk rules version: points, thresholds and high-risk countries. Another settings holder approves it. */
export function RiskRulesChangeDialog({ open, rules, onClose, onAsked }: Props) {
  const current = rules.current.definition;
  const [draft, setDraft] = useState<AmlaRiskDraft>(() => amlaRiskDraft(current));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  const view = amlaRiskRulesView(rules, rules.current);

  if (useDialogOpening(open, rules)) {
    setDraft(amlaRiskDraft(current));
    setReason("");
    setError(null);
  }

  function setPoints(factor: string, value: string, points: string) {
    setDraft((d) => ({ ...d, factors: { ...d.factors, [factor]: { ...d.factors[factor], [value]: points } } }));
    setError(null);
  }

  function ask() {
    const result = amlaRiskChangeBody(current, draft, reason);
    if ("error" in result) return setError(result.error);
    run(() => amlaApi.ask(result.body))
      ?.then(() => {
        notifySuccess("Rule change asked for", "It applies once another AMLA settings holder approves it in Settings, AMLA.");
        onAsked();
      })
      .catch((err: unknown) => notifyError(err, "The rule change couldn't be asked for."));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Ask for a risk rule change</DialogTitle>
          <DialogDescription>
            The new version applies at each customer&apos;s next assessment, once another AMLA settings holder approves it.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {view.factors.map((factor) => (
            <fieldset key={factor.key} className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{factor.label}</legend>
              <div className="flex flex-wrap gap-3">
                {factor.values.map((value) => {
                  const id = `risk-${factor.key}-${value.key}`;
                  return (
                    <div key={value.key} className="space-y-1">
                      <Label htmlFor={id}>{value.label} (points)</Label>
                      <Input
                        id={id}
                        inputMode="numeric"
                        className="w-28"
                        value={draft.factors[factor.key]?.[value.key] ?? ""}
                        disabled={submitting}
                        onChange={(e) => setPoints(factor.key, value.key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="risk-medium">Medium from (points)</Label>
              <Input id="risk-medium" inputMode="numeric" className="w-28" value={draft.medium} disabled={submitting} onChange={(e) => setDraft({ ...draft, medium: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="risk-high">High from (points)</Label>
              <Input id="risk-high" inputMode="numeric" className="w-28" value={draft.high} disabled={submitting} onChange={(e) => setDraft({ ...draft, high: e.target.value })} />
            </div>
            <div className="min-w-60 flex-1 space-y-1">
              <Label htmlFor="risk-countries">High-risk countries (two-letter codes)</Label>
              <Input id="risk-countries" value={draft.countries} disabled={submitting} placeholder="KP, IR" onChange={(e) => setDraft({ ...draft, countries: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="risk-reason">Reason</Label>
            <Textarea id="risk-reason" value={reason} maxLength={1000} disabled={submitting} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={ask} disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            Ask for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
