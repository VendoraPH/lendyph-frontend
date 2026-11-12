"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { cdaService } from "@/services";
import { notifySuccess, notifyValidation } from "@/lib/notify";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyCdaError } from "../../_lib/notify-cda";
import {
  REQUIREMENT_STATUS_META,
  requirementForm,
  requirementMissing,
  requirementPayload,
  type RequirementForm,
} from "../../_lib/review-chain";
import type { CdaRequirement, CdaRequirementStatus } from "@/types/cda";

const STATUS_OPTIONS = (Object.keys(REQUIREMENT_STATUS_META) as CdaRequirementStatus[]).map((value) => ({
  value,
  label: REQUIREMENT_STATUS_META[value].label,
}));

/**
 * Add or change a custom compliance requirement (`cda:prepare`): a deadline
 * the cooperative tracks beside the CDA reports. The server checks the dates
 * (an extension never before the due date, a filing date only once filed and
 * never in the future) and its refusal shows in words.
 */
export function RequirementDialog({
  open,
  onOpenChange,
  year,
  requirement,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  /** null adds one. */
  requirement: CdaRequirement | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RequirementForm>(requirementForm(null));
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, requirement)) setForm(requirementForm(requirement));
  const set = <K extends keyof RequirementForm>(key: K) => (value: RequirementForm[K]) => setForm({ ...form, [key]: value });

  function submit() {
    const missing = requirementMissing(form);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    const data = requirementPayload(form);
    setBusy(true);
    (requirement ? cdaService.updateRequirement(requirement.id, data) : cdaService.createRequirement(year, data))
      .then(() => {
        notifySuccess(requirement ? "Requirement saved" : "Requirement added");
        onOpenChange(false);
        onSaved();
      })
      .catch((err: unknown) => notifyCdaError(err, "Could not save the requirement"))
      .finally(() => setBusy(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{requirement ? "Edit requirement" : "Add requirement"}</DialogTitle>
          <DialogDescription>
            A deadline to track on the {year} compliance calendar. Pending items get the same deadline reminders as the reports.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cda-req-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="cda-req-title" maxLength={120} value={form.title} onChange={(e) => set("title")(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cda-req-description">Description</Label>
            <Textarea
              id="cda-req-description"
              maxLength={2000}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              className="min-h-20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-req-due">
              Due date <span className="text-destructive">*</span>
            </Label>
            <Input id="cda-req-due" type="date" value={form.default_due_on} onChange={(e) => set("default_due_on")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-req-extended">Extended to</Label>
            <Input
              id="cda-req-extended"
              type="date"
              min={form.default_due_on || undefined}
              value={form.extended_due_on}
              onChange={(e) => set("extended_due_on")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-req-reference">Reference</Label>
            <Input
              id="cda-req-reference"
              maxLength={120}
              placeholder="e.g. memorandum circular number"
              value={form.reference}
              onChange={(e) => set("reference")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-req-status">Status</Label>
            <NativeSelect
              id="cda-req-status"
              value={form.status}
              onChange={(e) => {
                const status = e.target.value as CdaRequirementStatus;
                setForm({ ...form, status, filed_on: status === "filed" ? form.filed_on || todayISO() : form.filed_on });
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {form.status === "filed" && (
            <div className="space-y-2">
              <Label htmlFor="cda-req-filed">
                Date filed <span className="text-destructive">*</span>
              </Label>
              <Input id="cda-req-filed" type="date" max={todayISO()} value={form.filed_on} onChange={(e) => set("filed_on")(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : requirement ? "Save changes" : "Add requirement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
