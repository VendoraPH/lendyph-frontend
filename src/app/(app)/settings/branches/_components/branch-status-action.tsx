"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DisabledReason } from "@/components/common/disabled-reason";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { usePermission } from "@/hooks/use-permission";
import { branchStatusAction, mayChangeBranchStatus } from "@/lib/branch-status";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { branchService, type ApiBranch } from "@/services/branch.service";

const COPY = {
  suspended: {
    title: "Suspend branch",
    description:
      "A suspended branch takes no new members, loans, releases, accounts or placements. Collections and withdrawals continue. The reason goes into the audit trail.",
    done: "suspended",
  },
  active: {
    title: "Reactivate branch",
    description: "The branch takes new business again. The reason goes into the audit trail.",
    done: "reactivated",
  },
} as const;

/**
 * Suspend or Reactivate, with a required reason, through
 * `PATCH /branches/{id}/status`. Shown only to branches:manage plus
 * branches:view_all holders; works with the multi-branch flag off.
 */
export function BranchStatusActionButton({ branch, onChanged }: { branch: ApiBranch; onChanged: () => void }) {
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const action = branchStatusAction(branch);
  if (!action || !mayChangeBranchStatus(can)) return null;

  const copy = COPY[action.target];
  const suspending = action.target === "suspended";

  return (
    <>
      <DisabledReason reason={action.disabledReason}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs",
            suspending
              ? "text-destructive border-destructive/30 hover:bg-destructive/5"
              : "text-green-600 border-green-500/30 hover:bg-green-500/5",
          )}
          disabled={action.disabledReason !== null}
          aria-label={`${action.label} ${branch.name}`}
          onClick={() => setOpen(true)}
        >
          {action.label}
        </Button>
      </DisabledReason>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`${copy.title}: ${branch.name}`}
        description={copy.description}
        confirmLabel={action.label}
        destructive={suspending}
        onConfirm={async (reason) => {
          await branchService.changeStatus(branch.id, { status: action.target, reason });
          notifySuccess(`${branch.name} ${copy.done}`);
          onChanged();
        }}
      />
    </>
  );
}
