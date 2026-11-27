"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaApi } from "@/lib/amla/api";
import { amlaSettingsChangeBody, amlaSettingsDraft, type AmlaSettingDraft, type AmlaSettingsDraft } from "@/lib/amla/settings-view";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaSetting } from "@/types/amla";
import { AmlaSettingField } from "./amla-setting-field";

interface Props {
  open: boolean;
  settings: AmlaSetting[];
  onClose: () => void;
  onAsked: () => void;
}

/**
 * Ask for a settings change: new values, settings confirmed (with what
 * confirmed them) or marked to verify again, and a reason. Nothing applies
 * until another AMLA settings holder approves it; the server checks the limits.
 */
export function AmlaSettingsChangeDialog({ open, settings, onClose, onAsked }: Props) {
  const [draft, setDraft] = useState<AmlaSettingsDraft>(() => amlaSettingsDraft(settings));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, settings)) {
    setDraft(amlaSettingsDraft(settings));
    setReason("");
    setError(null);
  }

  function update(key: string, next: AmlaSettingDraft) {
    setDraft((current) => ({ ...current, [key]: next }));
    setError(null);
  }

  function ask() {
    const result = amlaSettingsChangeBody(settings, draft, reason);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    run(() => amlaApi.ask(result.body))
      ?.then(() => {
        notifySuccess("Change asked for", "It applies once another AMLA settings holder approves it.");
        onAsked();
      })
      .catch((err: unknown) => notifyError(err, "The change couldn't be asked for."));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Ask for a change to the AMLA settings</DialogTitle>
          <DialogDescription>
            Change only what needs changing. Another AMLA settings holder approves it before it applies, as a new
            version; the settings in force stay as they are until then.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {settings.map((setting) => (
            <AmlaSettingField
              key={setting.key}
              setting={setting}
              draft={draft[setting.key]}
              disabled={submitting}
              onChange={(next) => update(setting.key, next)}
            />
          ))}
          <div className="space-y-2">
            <Label htmlFor="amla-change-reason">Reason</Label>
            <Textarea
              id="amla-change-reason"
              value={reason}
              maxLength={1000}
              disabled={submitting}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
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
