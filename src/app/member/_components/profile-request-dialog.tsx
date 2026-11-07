"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { PROFILE_FIELDS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { PortalProfile, ProfileUpdateField } from "@/types/portal";

interface Row {
  field: ProfileUpdateField;
  requested: string;
}

const FIELDS = Object.keys(PROFILE_FIELDS) as ProfileUpdateField[];

interface ProfileRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: PortalProfile;
  onSubmitted: () => void;
}

/**
 * Ask the cooperative to change contact or personal details. Nothing changes
 * until staff approve it: the member sees the request and its outcome below.
 */
export function ProfileRequestDialog({ open, onOpenChange, profile, onSubmitted }: ProfileRequestDialogProps) {
  const [rows, setRows] = useState<Row[]>([{ field: "address", requested: "" }]);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, profile)) {
    setRows([{ field: "address", requested: "" }]);
    setRemarks("");
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused = FIELDS.filter((f) => !rows.some((r) => r.field === f));
  const filled = rows.filter((r) => r.requested.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filled.length === 0) return notifyValidation(["A new value"]);
    setBusy(true);
    portalService
      .submitProfileRequest({
        changes: filled.map((r) => ({ field: r.field, requested: r.requested.trim() })),
        remarks: remarks.trim() || undefined,
      })
      .then((req) => {
        notifySuccess("Request sent", `Reference ${req.reference}. We will let you know once it is reviewed.`);
        onOpenChange(false);
        onSubmitted();
      })
      .catch((err) => notifyError(err, "Your request could not be sent."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>
            Your cooperative reviews every change. You may be asked for a supporting document.
          </DialogDescription>
        </DialogHeader>
        <form id="profile-request" className="space-y-4" onSubmit={submit}>
          {rows.map((row, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`field-${i}`}>Detail</Label>
                  <NativeSelect
                    id={`field-${i}`}
                    className="w-full"
                    value={row.field}
                    onChange={(e) => update(i, { field: e.target.value as ProfileUpdateField })}
                  >
                    {[row.field, ...unused].map((f) => (
                      <NativeSelectOption key={f} value={f}>
                        {PROFILE_FIELDS[f]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${PROFILE_FIELDS[row.field]}`}
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Now: {profile[row.field] || "—"}</p>
              <Label htmlFor={`value-${i}`} className="sr-only">
                New {PROFILE_FIELDS[row.field].toLowerCase()}
              </Label>
              <Input
                id={`value-${i}`}
                placeholder={`New ${PROFILE_FIELDS[row.field].toLowerCase()}`}
                value={row.requested}
                onChange={(e) => update(i, { requested: e.target.value })}
              />
            </div>
          ))}
          {unused.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows([...rows, { field: unused[0], requested: "" }])}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Change another detail
            </Button>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="remarks">Note to the cooperative (optional)</Label>
            <Textarea id="remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="profile-request" disabled={busy || filled.length === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
