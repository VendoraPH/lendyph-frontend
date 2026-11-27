"use client";

import { cn } from "@/lib/utils";
import type { LoanIssueView } from "../_lib/auto-pay-view";

interface LoanIssuesListProps {
  title: string;
  description?: string;
  issues: LoanIssueView[];
  tone: "amber" | "red";
}

/** Loans left out of a preview or a run, each with the server's reason. */
export function LoanIssuesList({ title, description, issues, tone }: LoanIssuesListProps) {
  if (issues.length === 0) return null;
  return (
    <section
      className={cn(
        "rounded-lg border p-4",
        tone === "red"
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
      )}
    >
      <h3
        className={cn(
          "text-sm font-semibold",
          tone === "red" ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200",
        )}
      >
        {title} ({issues.length})
      </h3>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <ul className="mt-2 space-y-1.5 text-sm">
        {issues.map((issue) => (
          <li key={issue.loanId} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <span className="shrink-0 font-mono text-xs leading-5">{issue.account}</span>
            <span className="text-muted-foreground">{issue.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
