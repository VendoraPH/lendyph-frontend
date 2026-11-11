"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { useAuthStore } from "@/store";
import { cdaService } from "@/services";
import { httpStatusOf } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ACTION_LABELS, NEEDS_REASON, STAGES_BY_TYPE, labelOf } from "../_lib/labels";
import { ReasonDialog } from "./reason-dialog";
import { FilingDialog, FinalizeDialog, StageDialog } from "./workflow-dialogs";
import type { CdaReport, CdaWorkflowAction, CdaWorkflowInput } from "@/types/cda";

const QUIET: ReadonlySet<CdaWorkflowAction> = new Set(["return", "reopen", "mark_for_correction", "refresh", "set_stage"]);

/**
 * The steps the server says the user can take now (`available_actions`,
 * carried over from #510 by Augustin and moved onto the server's list). A
 * reason is asked where the server needs one, warnings are confirmed to
 * finalize, and a filing records how and when. A 409 means the report moved
 * on: it reloads.
 */
export function WorkflowActions({
  report,
  onChange,
  onReload,
  reloading = false,
}: {
  report: CdaReport;
  onChange: (report: CdaReport) => void;
  onReload: () => void;
  /** The report is being read again (after a register write): the steps wait for it. */
  reloading?: boolean;
}) {
  const { can } = usePermission();
  const userId = useAuthStore((s) => s.user?.id);
  const [busy, setBusy] = useState<CdaWorkflowAction | null>(null);
  const [dialog, setDialog] = useState<CdaWorkflowAction | null>(null);

  function run(input: CdaWorkflowInput): Promise<void> {
    setBusy(input.action);
    return cdaService
      .runWorkflow(report.id, input)
      .then((next) => {
        notifySuccess(`${labelOf(ACTION_LABELS, input.action)}: done`);
        onChange(next);
      })
      .catch((err: unknown) => {
        notifyError(err, `Could not ${labelOf(ACTION_LABELS, input.action).toLowerCase()}`);
        if (httpStatusOf(err) === 409) onReload();
        throw err;
      })
      .finally(() => setBusy(null));
  }

  function start(action: CdaWorkflowAction) {
    if (NEEDS_REASON.has(action) || action === "finalize" || action === "mark_submitted" || action === "set_stage") {
      setDialog(action);
      return;
    }
    run({ action }).catch(() => undefined);
  }

  const actions = report.available_actions;
  const ownReview =
    report.status === "for_review" &&
    can("cda:approve") &&
    report.submitted_for_review_by !== null &&
    String(report.submitted_for_review_by.id) === String(userId) &&
    !actions.includes("approve");

  if (actions.length === 0 && !ownReview) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={QUIET.has(action) ? "outline" : "default"}
          disabled={busy !== null || reloading}
          onClick={() => start(action)}
        >
          {busy === action ? "Working…" : labelOf(ACTION_LABELS, action)}
        </Button>
      ))}
      {ownReview && (
        <p className="w-full text-xs text-muted-foreground">
          You sent this report for review, so someone else approves it.
        </p>
      )}

      <ReasonDialog
        open={dialog !== null && NEEDS_REASON.has(dialog)}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog ? labelOf(ACTION_LABELS, dialog) : ""}
        description="The reason is kept in this report's history and audit trail."
        confirmLabel={dialog ? labelOf(ACTION_LABELS, dialog) : "Confirm"}
        onConfirm={(reason) => (dialog ? run({ action: dialog, reason }) : Promise.resolve())}
      />
      <FinalizeDialog
        open={dialog === "finalize"}
        onOpenChange={(open) => !open && setDialog(null)}
        warnings={report.warning_count}
        onConfirm={() => run({ action: "finalize", confirm_warnings: report.warning_count > 0 })}
      />
      <FilingDialog
        open={dialog === "mark_submitted"}
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(submission) => run({ action: "mark_submitted", submission })}
      />
      <StageDialog
        open={dialog === "set_stage"}
        onOpenChange={(open) => !open && setDialog(null)}
        stages={STAGES_BY_TYPE[report.report_type] ?? []}
        current={report.stage}
        onConfirm={(stage) => run({ action: "set_stage", stage })}
      />
    </div>
  );
}
