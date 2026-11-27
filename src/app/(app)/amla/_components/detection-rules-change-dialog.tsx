"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaApi } from "@/lib/amla/api";
import {
  AMLA_PRIORITY_OPTIONS,
  amlaDetectionChangeBody,
  amlaDetectionDraft,
  amlaParamFieldLabel,
  amlaPublicText,
  amlaRuleParamKind,
  amlaRuleParamLabel,
  type AmlaDetectionDraft,
} from "@/lib/amla/monitoring-view";
import { amlaRuleTitle } from "@/lib/amla/rule-words";
import { AMLA_CHANNEL_OPTIONS } from "@/lib/amla/settings-view";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaDetectionRulesVersion } from "@/types/amla-monitoring";

interface Props {
  open: boolean;
  version: AmlaDetectionRulesVersion;
  onClose: () => void;
  onAsked: () => void;
}

/**
 * Ask for the next detection rules version. It applies to new transactions
 * only, once another AMLA settings holder approves it in Settings → AMLA.
 */
export function DetectionRulesChangeDialog({ open, version, onClose, onAsked }: Props) {
  const [draft, setDraft] = useState<AmlaDetectionDraft>(() => amlaDetectionDraft(version));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, version)) {
    setDraft(amlaDetectionDraft(version));
    setReason("");
    setError(null);
  }

  function update(code: string, next: Partial<AmlaDetectionDraft[string]>) {
    setDraft((current) => ({ ...current, [code]: { ...current[code], ...next } }));
    setError(null);
  }

  function ask() {
    const result = amlaDetectionChangeBody(version, draft, reason);
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
          <DialogTitle>Ask for a detection rule change</DialogTitle>
          <DialogDescription>
            Change only what needs changing. The new version applies to new transactions once another AMLA settings holder
            approves it; every value stays a starting point to verify.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {version.rules.map((rule) => {
            const entry = draft[rule.code];
            if (!entry) return null;
            return (
              <fieldset key={rule.code} className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">{amlaRuleTitle(rule.code, rule.rule)}</legend>
                {rule.availability !== "Available" && <p className="text-xs text-muted-foreground">{amlaPublicText(rule.availability)}</p>}
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={entry.active} disabled={submitting} onCheckedChange={(on) => update(rule.code, { active: on === true })} />
                    On
                  </label>
                  <div className="space-y-1">
                    <Label htmlFor={`rule-${rule.code}-priority`}>Priority</Label>
                    <NativeSelect
                      id={`rule-${rule.code}-priority`}
                      value={entry.priority}
                      disabled={submitting}
                      onChange={(e) => update(rule.code, { priority: e.target.value })}
                    >
                      {AMLA_PRIORITY_OPTIONS.map((o) => (
                        <NativeSelectOption key={o.value} value={o.value}>
                          {o.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  {Object.entries(entry.params).map(([name, value]) => {
                    const id = `rule-${rule.code}-${name}`;
                    const kind = amlaRuleParamKind(rule, name);
                    const label = amlaRuleParamLabel(rule, name);
                    if (kind === "channels") {
                      const picked = Array.isArray(value) ? value : [];
                      return (
                        <div key={name} role="group" aria-label={`${rule.code}: ${label}`} className="space-y-1">
                          <span className="text-sm font-medium">{label}</span>
                          <div className="flex flex-wrap gap-3">
                            {AMLA_CHANNEL_OPTIONS.map((o) => (
                              <label key={o.value} className="flex items-center gap-1.5 text-sm">
                                <Checkbox
                                  checked={picked.includes(o.value)}
                                  disabled={submitting}
                                  onCheckedChange={(on) =>
                                    update(rule.code, {
                                      params: { ...entry.params, [name]: on ? [...picked, o.value] : picked.filter((c) => c !== o.value) },
                                    })
                                  }
                                />
                                {o.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={name} className="space-y-1">
                        <Label htmlFor={id}>{amlaParamFieldLabel(label, kind)}</Label>
                        <Input
                          id={id}
                          value={String(value)}
                          inputMode={kind === "peso" ? "decimal" : "numeric"}
                          disabled={submitting}
                          className="w-36"
                          onChange={(e) => update(rule.code, { params: { ...entry.params, [name]: e.target.value } })}
                        />
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <div className="space-y-1">
            <Label htmlFor="rule-change-reason">Reason</Label>
            <Textarea id="rule-change-reason" value={reason} maxLength={1000} disabled={submitting} onChange={(e) => setReason(e.target.value)} />
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
