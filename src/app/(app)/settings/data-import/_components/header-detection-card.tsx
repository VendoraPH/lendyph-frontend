"use client";

/**
 * "Is row 1 a header, or is it a member?"
 *
 * The client's spec sheet tells coops to DELETE the header row before
 * uploading, and both files are positional — a column's meaning is its index
 * and nothing else. So there are two ways to get this wrong and each is silent:
 * a header left in place is imported as a borrower called "Last Name", and a
 * header wrongly assumed skips the first real member of the file.
 *
 * `detectHeaderRow` decides, this shows what it decided and what it decided it
 * from, and the admin can overrule it. The override defaults to the detection
 * rather than to a fixed answer, because the detection is right far more often
 * than a default would be — but the file is the admin's, not ours.
 */

import { AlertTriangle, Check, FileText, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCount } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import type { FileInspection } from "../_hooks/use-file-precheck";

/** Mismatched positions listed before the rest are summarised away. */
const MISMATCH_PREVIEW = 4;

export interface HeaderDetectionCardProps {
  inspection: FileInspection;
  /** Whether row 1 is currently being treated as a header. */
  skipHeader: boolean;
  /** True once the admin has moved the choice off the detected value. */
  overridden: boolean;
  onSkipHeaderChange: (skip: boolean) => void;
}

function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function HeaderDetectionCard({
  inspection,
  skipHeader,
  overridden,
  onSkipHeaderChange,
}: HeaderDetectionCardProps) {
  const { header, expectedColumns, widths, label } = inspection;
  const found = widths[0]?.columns ?? 0;
  const widthMatches = found === expectedColumns;
  const raggedRows = widths.slice(1).reduce((sum, entry) => sum + entry.rows, 0);
  const detected = header?.isHeader ?? false;
  const groupName = `header-${inspection.kind}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          {label} — header row
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* What was found, and from what evidence. */}
        {header === null ? (
          <p className="text-sm text-muted-foreground">
            This file has no rows, so there is nothing to inspect.
          </p>
        ) : header.reordered ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Shuffle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-medium">Row 1 is the header, but the columns are in a different order.</p>
              <p className="mt-1 text-muted-foreground">
                {percent(header.labelScore)} of the expected labels are present, but only{" "}
                {percent(header.positionalScore)} are in the position this import reads them from. The
                file is read by position, so importing it as it stands would write each value into the
                wrong field. Reorder the columns to match the workbook and export again.
              </p>
            </div>
          </div>
        ) : detected ? (
          <p className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              Row 1 is the column header row — {percent(header.labelScore)} of the expected labels
              matched, in the expected order.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              Row 1 looks like data, not a header — only {percent(header.labelScore)} of the expected
              labels are present. It will be imported as a record.
            </span>
          </p>
        )}

        {/* The positions that disagree. Only useful when a header is there. */}
        {header?.reordered && header.mismatched.length > 0 && (
          <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
            {header.mismatched.slice(0, MISMATCH_PREVIEW).map((mismatch) => (
              <li key={mismatch.index} className="flex flex-wrap gap-x-1.5 tabular-nums">
                <span className="text-muted-foreground">Column {mismatch.index + 1}</span>
                <span>
                  should be <span className="font-medium">{mismatch.expected}</span>
                </span>
                <span className="text-muted-foreground">
                  but holds {mismatch.found ? `“${mismatch.found}”` : "nothing"}
                </span>
              </li>
            ))}
            {header.mismatched.length > MISMATCH_PREVIEW && (
              <li className="text-muted-foreground">
                …and {formatCount(header.mismatched.length - MISMATCH_PREVIEW)} more.
              </li>
            )}
          </ul>
        )}

        {/* Column count found versus expected. */}
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            widthMatches ? "bg-muted/30" : "border-destructive/40 bg-destructive/5",
          )}
        >
          {widthMatches ? (
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <div>
            <p className="tabular-nums">
              <span className="font-medium">{found}</span> columns found,{" "}
              <span className="font-medium">{expectedColumns}</span> expected.
            </p>
            {raggedRows > 0 && (
              <p className="mt-1 text-muted-foreground">
                {formatCount(raggedRows)} {raggedRows === 1 ? "row does" : "rows do"} not have{" "}
                {found} columns. Those rows are listed below.
              </p>
            )}
          </div>
        </div>

        {/* The override. Defaults to the detection above. */}
        {header !== null && (
          <fieldset className="space-y-2">
            <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
              How should row 1 be treated?
              {overridden && (
                <Badge variant="outline" className="font-normal">
                  Changed from what was detected
                </Badge>
              )}
            </legend>
            <RadioGroup
              name={groupName}
              value={skipHeader ? "skip" : "import"}
              onValueChange={(value) => onSkipHeaderChange(value === "skip")}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5">
                <RadioGroupItem value="skip" className="mt-0.5" />
                <span>
                  Skip it — it is the header row
                  {detected && <span className="ml-1.5 text-xs text-muted-foreground">(detected)</span>}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5">
                <RadioGroupItem value="import" className="mt-0.5" />
                <span>
                  Import it — it is a record
                  {!detected && <span className="ml-1.5 text-xs text-muted-foreground">(detected)</span>}
                </span>
              </label>
            </RadioGroup>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
