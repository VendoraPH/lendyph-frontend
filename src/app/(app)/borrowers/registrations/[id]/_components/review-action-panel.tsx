// src/app/(app)/borrowers/registrations/[id]/_components/review-action-panel.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Pencil } from "lucide-react";
import type { Registration } from "@/services/registration.service";
import { formatDate, formatDateTime } from "@/lib/format";
import { reviewerLabel } from "@/app/(app)/borrowers/_components/utils";

interface Props {
  registration: Registration;
  editMode: boolean;
  approving: boolean;
  savingEdit: boolean;
  onApprove: () => void;
  onReject: () => void;
  onToggleEdit: () => void;
  onSaveEdit: () => void;
}

function StatusPill({ status }: { status: Registration["status"] }) {
  const rejected = status === "rejected";
  return (
    <span
      className={
        rejected
          ? "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground"
          : "inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${rejected ? "bg-muted-foreground" : "bg-amber-500"}`}
      />
      {rejected ? "Rejected" : "Pending"}
    </span>
  );
}

export function ReviewActionPanel({
  registration,
  editMode,
  approving,
  savingEdit,
  onApprove,
  onReject,
  onToggleEdit,
  onSaveEdit,
}: Props) {
  const submittedDate = registration.submitted_at
    ? formatDate(registration.submitted_at)
    : "—";

  // A rejected application is a record, not a decision still to be made. The
  // approve/reject/edit buttons all 422 against it server-side ("Only borrowers
  // with a pending registration can be approved"), so showing them would offer
  // an action that cannot succeed. This panel becomes the outcome instead —
  // which is also the only place the recorded `rejection_reason` has ever been
  // rendered.
  const isRejected = registration.status === "rejected";
  const reviewer = reviewerLabel(registration);

  return (
    <Card className="sticky top-6">
      <CardContent className="pt-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Admin Decision</h3>

        <div className="space-y-2 pb-4 border-b border-border text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusPill status={registration.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Submitted</span>
            <span className="font-semibold">{submittedDate}</span>
          </div>
        </div>

        {isRejected ? (
          <div className="space-y-3">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">Rejected on</dt>
                <dd className="font-semibold text-right">
                  {registration.rejected_at ? (
                    <time dateTime={registration.rejected_at}>
                      {formatDateTime(registration.rejected_at)}
                    </time>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">Rejected by</dt>
                <dd className="font-semibold text-right">{reviewer ?? "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground">Reason</dt>
                <dd className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap break-words">
                  {registration.rejection_reason || "No reason was recorded."}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              The applicant was kept on file rather than deleted. Rejection is
              final — to admit them, they submit a new application.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {editMode ? (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={onSaveEdit}
                    disabled={savingEdit}
                  >
                    {savingEdit ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <><CheckCircle className="mr-2 h-4 w-4" /> Save &amp; Approve</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onToggleEdit}
                    disabled={savingEdit}
                  >
                    Cancel Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={onApprove}
                    disabled={approving}
                  >
                    {approving ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving...</>
                    ) : (
                      <><CheckCircle className="mr-2 h-4 w-4" /> Approve &amp; Create Member</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/5"
                    onClick={onReject}
                    disabled={approving}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject Registration
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-muted-foreground"
                    onClick={onToggleEdit}
                    disabled={approving}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit Details Before Approving
                  </Button>
                </>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Approving creates a full member profile. Rejecting requires a reason that will be logged.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
