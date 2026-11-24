"use client";

import { useState } from "react";
import { NotebookPen, RotateCw } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent } from "@/components/ui/card";
import type { ApplicationDetail } from "@/types/loan-origination";
import { AssessmentPdfButton, FindingsDialog, RunAssessmentDialog } from "../../../_components/assessment-actions";
import { AssessmentReport } from "../../../_components/assessment-report";
import { canRunAssessment } from "../../../_lib/assessment-view";

/**
 * The application's current assessment, from the server, as this viewer may
 * see it. Running it and saving notes need `loan_origination:assess`, while
 * the application is under review and not handed off.
 */
export function AssessmentPanel({
  application: a,
  onChanged,
}: {
  application: ApplicationDetail;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<"run" | "findings" | null>(null);
  const assessment = a.assessment;
  const assessable = canRunAssessment(a);

  const runButton = assessable && (
    <PermissionButton permission="loan_origination:assess" size="sm" variant="outline" onClick={() => setOpen("run")}>
      <RotateCw className="mr-1 h-4 w-4" /> {assessment ? "Run again" : "Run assessment"}
    </PermissionButton>
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        {assessment ? (
          <>
            <div className="flex flex-wrap justify-end gap-2">
              {assessable && (
                <PermissionButton
                  permission="loan_origination:assess"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen("findings")}
                >
                  <NotebookPen className="mr-1 h-4 w-4" /> Findings
                </PermissionButton>
              )}
              {runButton}
              <AssessmentPdfButton assessment={assessment} />
            </div>
            <AssessmentReport assessment={assessment} />
            {(assessment.officer_findings || assessment.recommendations) && (
              <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Officer findings</p>
                  <p className="whitespace-pre-wrap">{assessment.officer_findings || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recommendations</p>
                  <p className="whitespace-pre-wrap">{assessment.recommendations || "—"}</p>
                </div>
              </div>
            )}
            <FindingsDialog
              assessment={assessment}
              open={open === "findings"}
              onOpenChange={(next) => setOpen(next ? "findings" : null)}
              onDone={onChanged}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {assessable
                ? "Not assessed yet. Run the assessment once the income and debts can be checked against the documents."
                : "Not assessed. Applications are assessed after they're submitted and before they're submitted for approval."}
            </p>
            {runButton}
          </div>
        )}
      </CardContent>
      <RunAssessmentDialog
        applicationId={a.id}
        current={assessment}
        open={open === "run"}
        onOpenChange={(next) => setOpen(next ? "run" : null)}
        onDone={onChanged}
      />
    </Card>
  );
}
