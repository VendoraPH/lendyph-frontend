"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { notifyValidation } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiRole } from "@/services/role.service";
import { newDraftKey, type CdaStepDraft } from "../_lib/cda-chain";
import { stepRoleOptions } from "../_lib/step-role-options";

/** Add or edit one CDA review step: a name, the role that approves it, and an optional status label. */
export function CdaStepDialog({
  open,
  onOpenChange,
  step,
  roles,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null adds one. */
  step: CdaStepDraft | null;
  roles: ApiRole[];
  onSave: (step: CdaStepDraft) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const roleOptions = stepRoleOptions(roles, role);

  if (useDialogOpening(open, step)) {
    setName(step?.name ?? "");
    setRole(step?.role ?? "");
    setStatus(step?.status ?? "");
  }

  function save() {
    const missing = [!name.trim() && "Step name", !role && "Required role"].filter((v): v is string => typeof v === "string");
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    onSave({ key: step?.key ?? newDraftKey(), name: name.trim(), role, status: status.trim() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{step ? "Edit Step" : "Add Step"}</DialogTitle>
          <DialogDescription>A CDA review step only approves; returning a report for changes stays open to its approvers.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cda-step-name">
              Step Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cda-step-name"
              maxLength={100}
              placeholder="e.g. Manager review"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-step-role">
              Required Role <span className="text-destructive">*</span>
            </Label>
            <Select items={roleOptions} value={role || null} onValueChange={(v) => setRole(v ?? "")}>
              <SelectTrigger id="cda-step-role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {roleOptions.length === 0
                ? "The role list needs permission to view users."
                : "Users with this role and CDA approval (or admins) approve this step."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-step-status">Status</Label>
            <Input
              id="cda-step-status"
              maxLength={100}
              placeholder="e.g. Board review"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown on the report&apos;s review steps while it waits at this step.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark">
            {step ? "Save Changes" : "Add Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
