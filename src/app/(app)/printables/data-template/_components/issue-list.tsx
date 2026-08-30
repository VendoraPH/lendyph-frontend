"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { TemplateIssue } from "@/lib/data-template/validate";

/**
 * What the workbook's rules say about what has been typed so far.
 *
 * Advisory, never blocking — see the note in `validate.ts`. Capped because a
 * sheet with a hundred half-filled rows produces a thousand of these, and the
 * first handful say everything the rest would.
 */

const MAX_SHOWN = 8;

export function IssueList({ issues }: { issues: TemplateIssue[] }) {
  if (issues.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle>Nothing to fix</AlertTitle>
        <AlertDescription>
          This sheet matches the template&apos;s rules.
        </AlertDescription>
      </Alert>
    );
  }

  const shown = issues.slice(0, MAX_SHOWN);
  const rest = issues.length - shown.length;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {issues.length} {issues.length === 1 ? "thing" : "things"} to check
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-1">
          {shown.map((issue, index) => (
            <li key={index} className="text-sm">
              <span className="font-medium">
                {issue.row === null ? "Columns" : `Row ${issue.row + 1}`}
              </span>{" "}
              — {issue.message}
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <p className="mt-2 text-xs opacity-80">
            and {rest} more.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
