"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, BellRing, HandCoins, MessageSquareMore, Send, StickyNote, UserCheck, UserPlus } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { allowedTransitions, isClosed, isUnsubmitted } from "@/lib/loan-origination";
import { notifyError, notifySuccess } from "@/lib/notify";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail, ApplicationStatus } from "@/types/loan-origination";
import { AssignDialog, ConvertDialog, LinkMemberDialog, SubmitForApprovalDialog } from "./handover-actions";
import { NoteDialog, RequestInfoDialog, TransitionDialog } from "./status-actions";

type Open = "transition" | "request" | "note" | "assign" | "link" | "submit" | "convert" | null;

/** Statuses where staff are still reviewing and may ask the applicant for more. */
const REVIEWING: readonly ApplicationStatus[] = ["submitted", "document_verification", "under_assessment", "pending_approval"];

/**
 * The action row on an application. Each button shows only when the action
 * fits the current status; the server still checks every move.
 */
export function ApplicationActions({ application: a, onChanged }: { application: ApplicationDetail; onChanged: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const closed = isClosed(a.status);
  const dialog = (which: Exclude<Open, null>) => ({
    application: a,
    open: open === which,
    onOpenChange: (next: boolean) => setOpen(next ? which : null),
    onDone: onChanged,
  });

  const remind = () =>
    loanOriginationService
      .remind(a.id)
      .then(() => notifySuccess("Reminder sent to the applicant"))
      .catch((err) => notifyError(err, "Could not send the reminder"));

  const button = (which: Exclude<Open, null>, label: string, Icon: typeof Send, primary = false) => (
    <PermissionButton
      permission={which === "convert" ? "loan_origination:convert" : "loan_origination:update"}
      size="sm"
      variant={primary ? "default" : "outline"}
      onClick={() => setOpen(which)}
    >
      <Icon className="mr-1 h-4 w-4" /> {label}
    </PermissionButton>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {a.status === "approved" && a.loan_id === null && button("convert", "Convert to loan", HandCoins, true)}
      {a.status === "under_assessment" && a.assessment && button("submit", "Submit for approval", Send, true)}
      {allowedTransitions(a.status).length > 0 && button("transition", "Change status", ArrowRightLeft)}
      {REVIEWING.includes(a.status) && button("request", "Request information", MessageSquareMore)}
      {!closed && button("assign", a.assigned_officer_name ? "Reassign" : "Assign officer", UserCheck)}
      {a.status !== "converted" && button("link", a.linked_borrower_id ? "Change member" : "Link member", UserPlus)}
      {isUnsubmitted(a.status) && (
        <PermissionButton permission="loan_origination:update" size="sm" variant="outline" onClick={remind}>
          <BellRing className="mr-1 h-4 w-4" /> Remind applicant
        </PermissionButton>
      )}
      {button("note", "Add note", StickyNote)}

      <TransitionDialog {...dialog("transition")} />
      <RequestInfoDialog {...dialog("request")} />
      <NoteDialog {...dialog("note")} />
      <AssignDialog {...dialog("assign")} />
      <LinkMemberDialog {...dialog("link")} />
      <SubmitForApprovalDialog {...dialog("submit")} />
      <ConvertDialog
        application={a}
        open={open === "convert"}
        onOpenChange={(next) => setOpen(next ? "convert" : null)}
        onConverted={(loanId) => router.push(`/loans/${loanId}`)}
      />
    </div>
  );
}
