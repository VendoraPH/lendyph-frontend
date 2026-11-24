"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, BellRing, ExternalLink, MessageSquareMore, Send, StickyNote, UserCheck, UserPlus } from "lucide-react";
import { DisabledReason } from "@/components/common/disabled-reason";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { httpStatusOf } from "@/lib/api-error";
import { reminderNotice } from "@/lib/loan-origination";
import { notifyError, notifySuccess } from "@/lib/notify";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail } from "@/types/loan-origination";
import { applicationActions, linkMemberBlocker, type ApplicationAction } from "../../../_lib/application-view";
import { handOffBlocker } from "../../../_lib/hand-off";
import { HandOffDialog } from "./hand-off-dialog";
import { AssignDialog, LinkMemberDialog } from "./officer-member-dialogs";
import { NoteDialog, RequestInfoDialog, TransitionDialog } from "./status-actions";

type Open = "hand_off" | "change_status" | "request_information" | "assign" | "link_member" | "note" | null;

/**
 * The action row. What shows follows the server (its `allowed_transitions`,
 * the hand-off and processing rules); every action sends the version read,
 * and a 409 reloads the application so staff see what changed.
 */
export function ApplicationActions({ application: a, onChanged }: { application: ApplicationDetail; onChanged: () => void }) {
  const { can } = usePermission();
  const [open, setOpen] = useState<Open>(null);
  const actions = applicationActions(a);
  const has = (action: ApplicationAction) => actions.includes(action);
  const dialog = (which: Exclude<Open, null>) => ({
    application: a,
    open: open === which,
    onOpenChange: (next: boolean) => setOpen(next ? which : null),
    onDone: onChanged,
    onFailed: (err: unknown) => {
      if (httpStatusOf(err) === 409) onChanged();
    },
  });

  const remind = () =>
    loanOriginationService
      .remind(a.id)
      .then((result) => notifySuccess(reminderNotice(result)))
      .then(onChanged)
      .catch((err) => notifyError(err, "Could not record the reminder"));

  const button = (which: Exclude<Open, null>, label: string, Icon: typeof Send) => (
    <PermissionButton permission="loan_origination:update" size="sm" variant="outline" onClick={() => setOpen(which)}>
      <Icon className="mr-1 h-4 w-4" /> {label}
    </PermissionButton>
  );
  const handOffReason = handOffBlocker(can, a.linked_borrower_id === null);
  const linkReason = linkMemberBlocker(can);

  return (
    <div className="flex flex-wrap gap-2">
      {has("open_loan") && a.loan_id !== null && (
        <Button size="sm" nativeButton={false} render={<Link href={`/loans/${a.loan_id}`} />}>
          <ExternalLink className="mr-1 h-4 w-4" /> Open loan
        </Button>
      )}
      {has("hand_off") && (
        <DisabledReason reason={handOffReason}>
          <Button size="sm" disabled={handOffReason !== null} onClick={() => setOpen("hand_off")}>
            <Send className="mr-1 h-4 w-4" /> Submit for approval
          </Button>
        </DisabledReason>
      )}
      {has("change_status") && button("change_status", "Change status", ArrowRightLeft)}
      {has("request_information") && button("request_information", "Request information", MessageSquareMore)}
      {has("assign") && button("assign", a.assigned_officer_name ? "Reassign" : "Assign officer", UserCheck)}
      {has("link_member") && (
        <DisabledReason reason={linkReason}>
          <Button size="sm" variant="outline" disabled={linkReason !== null} onClick={() => setOpen("link_member")}>
            <UserPlus className="mr-1 h-4 w-4" /> {a.linked_borrower_id === null ? "Link member" : "Change member"}
          </Button>
        </DisabledReason>
      )}
      {has("remind") && (
        <PermissionButton permission="loan_origination:update" size="sm" variant="outline" onClick={remind}>
          <BellRing className="mr-1 h-4 w-4" /> Remind applicant
        </PermissionButton>
      )}
      {has("note") && button("note", "Add note", StickyNote)}

      <HandOffDialog application={a} open={open === "hand_off"} onOpenChange={(next) => setOpen(next ? "hand_off" : null)} onDone={onChanged} />
      <TransitionDialog {...dialog("change_status")} />
      <RequestInfoDialog {...dialog("request_information")} />
      <AssignDialog {...dialog("assign")} />
      <LinkMemberDialog {...dialog("link_member")} />
      <NoteDialog {...dialog("note")} />
    </div>
  );
}
