"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/common/permission-button";
import { cdaService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import { countBySeverity } from "../_lib/readiness";
import {
  ACTION_LABEL,
  ACTION_PERMISSION,
  REASON_REQUIRED,
  availableActions,
  canTakeAction,
} from "../_lib/workflow";
import { ReasonDialog } from "./reason-dialog";
import type { CdaReport, CdaWorkflowAction } from "@/types/cda";

const BLOCKED_NOTE = "Resolve every Critical issue before sending this report for review or finalizing it.";

/**
 * The next steps a report can take, each behind its own permission. The
 * server enforces the same rules; these buttons only avoid offering a step it
 * would refuse.
 */
export function WorkflowActions({
  report,
  onChange,
}: {
  report: CdaReport;
  onChange: (report: CdaReport) => void;
}) {
  const [busy, setBusy] = useState<CdaWorkflowAction | null>(null);
  const [reasonFor, setReasonFor] = useState<CdaWorkflowAction | null>(null);
  const critical = countBySeverity(report.issues).critical;

  function run(action: CdaWorkflowAction, reason?: string): Promise<void> {
    setBusy(action);
    return cdaService
      .transition(report.year, report.type, { action, reason })
      .then((next) => {
        notifySuccess(`${ACTION_LABEL[action]} done`);
        onChange(next);
      })
      .catch((err: unknown) => {
        notifyError(err, `Could not ${ACTION_LABEL[action].toLowerCase()}`);
        throw err;
      })
      .finally(() => setBusy(null));
  }

  const actions = availableActions(report.status);
  if (actions.length === 0) return null;
  const blocked = actions.some((a) => !canTakeAction(a, report.status, critical));

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const allowed = canTakeAction(action, report.status, critical);
        return (
          <PermissionButton
            key={action}
            permission={ACTION_PERMISSION[action]}
            variant={action === "return" || action === "reopen" ? "outline" : "default"}
            size="sm"
            disabled={!allowed || busy !== null}
            onClick={() => (REASON_REQUIRED.has(action) ? setReasonFor(action) : run(action).catch(() => {}))}
          >
            {busy === action ? "Working…" : ACTION_LABEL[action]}
          </PermissionButton>
        );
      })}
      {blocked && <p className="w-full text-xs text-muted-foreground">{BLOCKED_NOTE}</p>}
      <ReasonDialog
        open={reasonFor !== null}
        onOpenChange={(open) => !open && setReasonFor(null)}
        title={reasonFor ? ACTION_LABEL[reasonFor] : ""}
        description="The reason is kept in this report's audit trail."
        confirmLabel={reasonFor ? ACTION_LABEL[reasonFor] : "Confirm"}
        onConfirm={(reason) => (reasonFor ? run(reasonFor, reason) : Promise.resolve())}
      />
    </div>
  );
}
