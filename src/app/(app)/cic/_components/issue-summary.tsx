import { summarizeCicIssues } from "@/lib/cic/validate";
import type { CicIssue } from "@/lib/cic/types";

function Figure({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

/** Records, errors, warnings and notes, and whether the file can be generated. */
export function IssueSummary({ issues, recordCount }: { issues: readonly CicIssue[]; recordCount: number }) {
  const s = summarizeCicIssues(issues);
  return (
    <div className="shrink-0 space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Records" value={recordCount} />
        <Figure label="Errors" value={s.errors} tone={s.errors > 0 ? "text-destructive" : undefined} />
        <Figure label="Warnings" value={s.warnings} />
        <Figure label="Information" value={s.infos} />
      </div>
      <p className="text-sm text-muted-foreground">
        {s.blocking
          ? "Errors block the file: CIC rejects a file with any of them. Fix them in Lendy, then reload."
          : "No errors. Warnings and information do not stop the file."}
      </p>
    </div>
  );
}
