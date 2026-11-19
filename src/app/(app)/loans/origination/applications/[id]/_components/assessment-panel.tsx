"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent } from "@/components/ui/card";
import type { Assessment } from "@/types/loan-origination";
import { AssessmentPdfButton, FindingsDialog, RerunAssessmentButton } from "../../../_components/assessment-actions";
import { AssessmentReport } from "../../../_components/assessment-report";

/** The application's latest assessment, with the officer's findings and the actions on it. */
export function AssessmentPanel({
  applicationId,
  assessment,
  onChanged,
}: {
  applicationId: number;
  assessment: Assessment | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!assessment) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Not assessed yet. The assessment runs when the application is submitted, or on demand.
          </p>
          <RerunAssessmentButton applicationId={applicationId} onDone={onChanged} />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap justify-end gap-2">
          <PermissionButton
            permission="loan_origination:assess"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            <NotebookPen className="mr-1 h-4 w-4" /> Findings
          </PermissionButton>
          <RerunAssessmentButton applicationId={applicationId} onDone={onChanged} />
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
      </CardContent>
      <FindingsDialog assessment={assessment} open={editing} onOpenChange={setEditing} onDone={onChanged} />
    </Card>
  );
}
