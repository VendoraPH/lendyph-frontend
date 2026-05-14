// src/app/(app)/borrowers/registrations/[id]/_components/review-action-panel.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Pencil } from "lucide-react";
import type { Registration } from "@/services/registration.service";
import { formatDate } from "@/lib/format";

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

  return (
    <Card className="sticky top-6">
      <CardContent className="pt-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Admin Decision</h3>

        <div className="space-y-2 pb-4 border-b border-border text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Pending
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Submitted</span>
            <span className="font-semibold">{submittedDate}</span>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}
