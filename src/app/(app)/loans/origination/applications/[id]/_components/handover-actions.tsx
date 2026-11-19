"use client";

import { useState } from "react";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { StaffPicker } from "@/components/common/staff-picker";
import { Label } from "@/components/ui/label";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { usePermission } from "@/hooks";
import type { MemberOption } from "@/hooks/use-member-search";
import { formatCurrency } from "@/lib/format";
import { loanOriginationService } from "@/services";
import type { StaffMember } from "@/types/staff";
import type { ApplicationDetail } from "@/types/loan-origination";
import { ActionDialog } from "../../../_components/action-dialog";

interface DialogProps {
  application: ApplicationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function AssignDialog({ application, open, onOpenChange, onDone }: DialogProps) {
  const current: StaffMember | null =
    application.assigned_officer_id && application.assigned_officer_name
      ? { id: application.assigned_officer_id, full_name: application.assigned_officer_name }
      : null;
  const [officer, setOfficer] = useState<StaffMember | null>(current);
  if (useDialogOpening(open, application.id)) setOfficer(current);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign a loan officer"
      confirmLabel={officer ? "Assign" : "Unassign"}
      successMessage={officer ? `Assigned to ${officer.full_name}` : "Officer removed"}
      errorMessage="Could not assign the officer"
      onConfirm={() => loanOriginationService.assign(application.id, officer?.id ?? null)}
      onDone={onDone}
    >
      <Label htmlFor="assign-officer">Officer</Label>
      <StaffPicker id="assign-officer" value={officer} onChange={setOfficer} clearable />
    </ActionDialog>
  );
}

/**
 * Links the application to an existing member. The server's matches are only
 * suggestions; nothing is linked until staff choose one here.
 */
export function LinkMemberDialog({ application, open, onOpenChange, onDone }: DialogProps) {
  const canSearch = usePermission().can("borrowers:view");
  const [member, setMember] = useState<MemberOption | null>(null);
  if (useDialogOpening(open, application.id)) setMember(null);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Link to an existing member"
      description="Choose the member this applicant already is. Leave it unlinked to create a new member when the application is converted."
      confirmLabel="Link member"
      successMessage="Member linked"
      errorMessage="Could not link the member"
      canConfirm={member !== null}
      onConfirm={() => loanOriginationService.linkMember(application.id, member?.id ?? null)}
      onDone={onDone}
      size="md"
    >
      {application.possible_member_matches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Possible matches</p>
          {application.possible_member_matches.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
              <input
                type="radio"
                name="member-match"
                className="mt-1 accent-brand-orange"
                checked={member?.id === m.id}
                onChange={() => setMember({ id: m.id, full_name: m.name, borrower_code: m.member_number ?? undefined })}
              />
              <span>
                <span className="font-medium">{m.name}</span>
                {m.member_number && <span className="text-muted-foreground"> · {m.member_number}</span>}
                <span className="block text-xs text-muted-foreground">{m.reason}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="link-member">Or search members</Label>
        <MemberSearchPicker
          id="link-member"
          value={member}
          onChange={setMember}
          canSearch={canSearch}
          placeholder="Search by name or member number"
        />
      </div>
    </ActionDialog>
  );
}

/** Hands an assessed application to the existing loan approval chain. */
export function SubmitForApprovalDialog({ application, open, onOpenChange, onDone }: DialogProps) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Submit for approval"
      description="The application goes to the loan approvers with its assessment, documents and notes. Its status becomes Pending approval."
      confirmLabel="Submit for approval"
      successMessage="Submitted for approval"
      errorMessage="Could not submit for approval"
      onConfirm={() => loanOriginationService.submitForApproval(application.id)}
      onDone={onDone}
    />
  );
}

/** Creates the loan record from an approved application. The server refuses a second one. */
export function ConvertDialog({
  application,
  open,
  onOpenChange,
  onConverted,
}: Omit<DialogProps, "onDone"> & { onConverted: (loanId: number) => void }) {
  const amount = application.requested_amount === null ? "the requested amount" : formatCurrency(application.requested_amount);
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Convert to a loan"
      description={
        <>
          Creates a loan of {amount}
          {application.loan_product_name ? ` on ${application.loan_product_name}` : ""} for{" "}
          {application.applicant_name}
          {application.linked_borrower_id ? ", using the linked member." : ", creating a new member record."} The
          application cannot be converted twice.
        </>
      }
      confirmLabel="Create loan"
      successMessage="Loan created"
      errorMessage="Could not create the loan"
      onConfirm={() => loanOriginationService.convert(application.id).then((r) => onConverted(r.loan_id))}
    />
  );
}
