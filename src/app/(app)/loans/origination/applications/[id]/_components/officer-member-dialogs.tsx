"use client";

import { useState } from "react";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { StaffPicker } from "@/components/common/staff-picker";
import { Label } from "@/components/ui/label";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import type { MemberOption } from "@/hooks/use-member-search";
import { loanOriginationService } from "@/services";
import type { StaffMember } from "@/types/staff";
import { ActionDialog } from "../../../_components/action-dialog";
import type { ApplicationDialogProps } from "./status-actions";

/**
 * Assigns the officer from `GET /staff?for=origination`: active holders of
 * `loan_origination:update` who can see the application's branch. A refused
 * pick answers one fixed message.
 */
export function AssignDialog({ application, open, onOpenChange, onDone, onFailed }: ApplicationDialogProps) {
  const current: StaffMember | null =
    application.assigned_officer_id !== null && application.assigned_officer_name
      ? { id: application.assigned_officer_id, full_name: application.assigned_officer_name }
      : null;
  const [officer, setOfficer] = useState<StaffMember | null>(current);
  if (useDialogOpening(open, application.id)) setOfficer(current);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign an officer"
      description="The officer is told in the app."
      confirmLabel={officer ? "Assign" : "Remove officer"}
      successMessage={officer ? `Assigned to ${officer.full_name}` : "Officer removed"}
      errorMessage="Could not assign the officer"
      canConfirm={(officer?.id ?? null) !== (current?.id ?? null)}
      onConfirm={() => loanOriginationService.assign(application.id, officer?.id ?? null, application.version)}
      onDone={onDone}
      onFailed={onFailed}
    >
      <Label htmlFor="assign-officer">Officer</Label>
      <StaffPicker
        id="assign-officer"
        purpose="origination"
        value={officer}
        onChange={setOfficer}
        clearable
        clearLabel="Clear officer"
        placeholder="Select an officer"
      />
    </ActionDialog>
  );
}

/**
 * Links the application to an existing member, or clears the link, until the
 * hand-off. The server's matches are suggestions only; nothing is linked
 * until staff choose. The member's record is never changed.
 */
export function LinkMemberDialog({ application, open, onOpenChange, onDone, onFailed }: ApplicationDialogProps) {
  const [member, setMember] = useState<MemberOption | null>(null);
  if (useDialogOpening(open, application.id)) setMember(null);
  const linked = application.linked_borrower_id;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={linked === null ? "Link an existing member" : "Change the linked member"}
      description={
        linked === null
          ? "Choose the member this applicant already is. Left unlinked, submitting for approval creates a new pending member."
          : "Choose another member, or remove the link so submitting for approval creates a new pending member."
      }
      confirmLabel={member ? "Link member" : "Remove the link"}
      successMessage={member ? `Linked to ${member.full_name}` : "Link removed"}
      errorMessage="Could not change the linked member"
      canConfirm={member !== null || linked !== null}
      onConfirm={() => loanOriginationService.linkMember(application.id, member?.id ?? null, application.version)}
      onDone={onDone}
      onFailed={onFailed}
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
        <Label htmlFor="link-member">{application.possible_member_matches.length > 0 ? "Or search members" : "Search members"}</Label>
        <MemberSearchPicker
          id="link-member"
          value={member}
          onChange={setMember}
          canSearch
          exclude={[linked]}
          showCode
          placeholder="Search by name or member number"
        />
      </div>
    </ActionDialog>
  );
}
