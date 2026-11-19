"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StaffPicker } from "@/components/common/staff-picker";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError, notifySuccess } from "@/lib/notify";
import { branchService, type ApiBranch, type BranchProfileData } from "@/services/branch.service";
import type { StaffMember } from "@/types";

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: ApiBranch | null;
  onSave: () => void;
  /** The multi-branch profile fields (email, manager, opening date, CDA authority). */
  profileFields: boolean;
}

interface FormState {
  name: string;
  code: string;
  address: string;
  contactNumber: string;
  email: string;
  manager: StaffMember | null;
  openedOn: string;
  cdaNumber: string;
  cdaIssuedOn: string;
}

function formFrom(branch: ApiBranch | null | undefined): FormState {
  return {
    name: branch?.name ?? "",
    code: branch?.code ?? "",
    address: branch?.address ?? "",
    contactNumber: branch?.contact_number ?? "",
    email: branch?.email ?? "",
    manager: branch?.manager ?? null,
    openedOn: branch?.opened_on ?? "",
    cdaNumber: branch?.cda_authority_number ?? "",
    cdaIssuedOn: branch?.cda_authority_issued_on ?? "",
  };
}

/** The profile fields as MB-BE1 takes them: an empty field clears it. */
function profileOf(form: FormState): BranchProfileData {
  return {
    email: form.email.trim() || null,
    manager_user_id: form.manager?.id ?? null,
    opened_on: form.openedOn || null,
    cda_authority_number: form.cdaNumber.trim() || null,
    cda_authority_issued_on: form.cdaIssuedOn || null,
  };
}

/** Add or edit a branch. Its status is never part of the form: it has its own action. */
export function BranchFormDialog({ open, onOpenChange, branch, onSave, profileFields }: BranchFormDialogProps) {
  const isEdit = !!branch;
  const [form, setForm] = useState<FormState>(() => formFrom(branch));
  const [saving, setSaving] = useState(false);
  if (useDialogOpening(open, branch)) setForm(formFrom(branch));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;

    const data = {
      name: form.name,
      code: form.code,
      address: form.address || undefined,
      contact_number: form.contactNumber || undefined,
      ...(profileFields ? profileOf(form) : {}),
    };
    setSaving(true);
    const saved = await (isEdit && branch ? branchService.update(branch.id, data) : branchService.create(data)).then(
      () => true,
      (err: unknown) => {
        notifyError(err, isEdit ? "We couldn't update the branch. Please try again." : "We couldn't create the branch. Please try again.");
        return false;
      },
    );
    setSaving(false);
    if (!saved) return;
    notifySuccess(isEdit ? "Branch updated" : "Branch created");
    onOpenChange(false);
    onSave();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={profileFields ? "lg" : "default"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Branch" : "Add New Branch"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the branch details below." : "Fill in the details to create a new branch."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="grid min-h-0 gap-4 overflow-y-auto sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="branch-name">
                Branch Name <span className="text-destructive">*</span>
              </Label>
              <Input id="branch-name" placeholder="Main Branch" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-code">
                Branch Code <span className="text-destructive">*</span>
              </Label>
              <Input id="branch-code" placeholder="MAIN" value={form.code} onChange={(e) => set("code", e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="branch-address">Address</Label>
              <Input id="branch-address" placeholder="123 Main St, Manila" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-contact">Contact Number</Label>
              <Input
                id="branch-contact"
                type="tel"
                placeholder="09171234567"
                value={form.contactNumber}
                onChange={(e) => set("contactNumber", e.target.value)}
              />
            </div>

            {profileFields && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="branch-email">Email</Label>
                  <Input id="branch-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-manager">Branch Manager</Label>
                  <StaffPicker
                    id="branch-manager"
                    value={form.manager}
                    onChange={(value) => set("manager", value)}
                    placeholder="Select branch manager"
                    clearable
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-opened-on">Opening Date</Label>
                  <Input
                    id="branch-opened-on"
                    type="date"
                    value={form.openedOn}
                    onChange={(e) => set("openedOn", e.target.value)}
                  />
                </div>
                <fieldset className="grid gap-4 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2">
                  <legend className="px-1 text-sm font-medium">
                    CDA authority <span className="font-normal text-muted-foreground">(to verify)</span>
                  </legend>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    What CDA needs a branch to keep is still to be confirmed, so these fields may change.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="branch-cda-number">Authority Number</Label>
                    <Input id="branch-cda-number" value={form.cdaNumber} onChange={(e) => set("cdaNumber", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-cda-issued">Date Issued</Label>
                    <Input
                      id="branch-cda-issued"
                      type="date"
                      value={form.cdaIssuedOn}
                      onChange={(e) => set("cdaIssuedOn", e.target.value)}
                    />
                  </div>
                </fieldset>
              </>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.name.trim() || !form.code.trim()}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Update Branch" : "Create Branch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
