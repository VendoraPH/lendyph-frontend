"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisabledReason } from "@/components/common/disabled-reason";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { usePermission } from "@/hooks/use-permission";
import { mainOfficeAction } from "@/lib/branch-page";
import { notifySuccess } from "@/lib/notify";
import { branchService, type ApiBranch } from "@/services/branch.service";

/** "Make main office", with a reason that goes into both branches' audit rows (multi-branch flag). */
export function MainOfficeAction({ branch, onChanged }: { branch: ApiBranch; onChanged: () => void }) {
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const action = mainOfficeAction(branch, can);
  if (!action) return null;

  return (
    <>
      <DisabledReason reason={action.disabledReason}>
        <Button variant="outline" size="sm" disabled={action.disabledReason !== null} onClick={() => setOpen(true)}>
          <Landmark className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Make main office
        </Button>
      </DisabledReason>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Make ${branch.name} the main office`}
        description="The current main office stops being the main office. The reason goes into both branches' audit trails."
        confirmLabel="Make main office"
        onConfirm={async (reason) => {
          await branchService.makeMainOffice(branch.id, { reason });
          notifySuccess(`${branch.name} is now the main office`);
          onChanged();
        }}
      />
    </>
  );
}

/** The main-office badge beside a branch's name. */
export function MainOfficeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-brand-orange/30 bg-brand-orange/10 px-1.5 py-0.5 text-xs font-medium text-brand-orange">
      <Landmark className="h-3 w-3" aria-hidden="true" />
      Main office
    </span>
  );
}
