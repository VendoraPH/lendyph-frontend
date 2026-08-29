"use client";

/**
 * The date-format question — the highest-risk thing on this screen.
 *
 * The client's workbook declares no date format at all, and `03/04/2020` is 3
 * April or 4 March with equal claim. Guess wrong and an entire cooperative's
 * loan book is silently re-dated: maturity dates, ageing buckets, penalty
 * accrual and every "as of" report move together, and nothing in the resulting
 * data looks broken. There is no error message at the end of that path, only a
 * borrower disputing their maturity date months later.
 *
 * So this component never guesses, and it never lets the screen guess either:
 *
 *  - `resolved` — say WHICH CELL proved it. A verdict with its evidence can be
 *    checked by the admin; a verdict without one can only be believed.
 *  - `ambiguous` — ASK. Both readings are rendered as real dates in words
 *    ("3 April 1975" / "4 March 1975"), because `2020-04-03` versus
 *    `2020-03-04` is exactly as easy to misread as the cell that caused the
 *    problem. No option is pre-selected.
 *  - `conflicted` / `unusable` — block the column and say what is in it. No
 *    setting rescues a column written both ways, and offering a choice would
 *    only let the admin pick which half of the file to corrupt.
 */

import { AlertTriangle, CalendarDays, Check, HelpCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCount } from "@/lib/report-format";
import type { DateColumnStats, DateOrder } from "@/lib/import-date";
import type { DateColumnFinding } from "../_hooks/use-file-precheck";
import { describeIsoDate } from "../_hooks/use-file-precheck";

export interface DateFormatCardProps {
  /** "Customer Profile" / "Loans" — names the file the columns belong to. */
  fileLabel: string;
  dates: readonly DateColumnFinding[];
  /** Called when the admin settles an ambiguous column. */
  onChooseOrder: (column: string, order: DateOrder) => void;
}

/** Mid-sentence: "Read day first (DD/MM/YYYY)." */
const ORDER_WORDS: Record<DateOrder, string> = {
  dmy: "day first (DD/MM/YYYY)",
  mdy: "month first (MM/DD/YYYY)",
};

/**
 * Sentence-start form for the radio labels.
 *
 * Written out rather than produced with Tailwind's `capitalize`, which is
 * per-WORD and renders "Day First (DD/MM/YYYY)".
 */
const ORDER_HEADINGS: Record<DateOrder, string> = {
  dmy: "Day first (DD/MM/YYYY)",
  mdy: "Month first (MM/DD/YYYY)",
};

/**
 * What the column is actually made of.
 *
 * Shown for every verdict, not just the bad ones: "resolved from 412 values, 3
 * of them Excel date numbers" is a claim an admin can check, and it is how they
 * notice that a column they believed was full of dates is 90% blank.
 */
function StatsLine({ stats }: { stats: DateColumnStats }) {
  const parts: string[] = [];
  if (stats.iso > 0) parts.push(`${formatCount(stats.iso)} already YYYY-MM-DD`);
  if (stats.pair > 0) parts.push(`${formatCount(stats.pair)} written with slashes`);
  if (stats.serial > 0) parts.push(`${formatCount(stats.serial)} Excel date numbers`);
  if (stats.shortYear > 0) parts.push(`${formatCount(stats.shortYear)} with a two-digit year`);
  if (stats.invalid > 0) parts.push(`${formatCount(stats.invalid)} not real dates`);
  if (stats.unrecognised > 0) parts.push(`${formatCount(stats.unrecognised)} not dates at all`);
  if (stats.blank > 0) parts.push(`${formatCount(stats.blank)} blank`);

  return (
    <p className="text-xs text-muted-foreground">
      {formatCount(stats.total)} values: {parts.length > 0 ? parts.join(", ") : "none"}.
    </p>
  );
}

function Samples({ label, values }: { label: string; values: readonly string[] }) {
  if (values.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {label}: {values.map((value) => `“${value}”`).join(", ")}
    </p>
  );
}

/**
 * The prompt. Both readings, side by side, in words.
 *
 * Nothing is pre-selected on purpose — a default here IS the guess this whole
 * module exists to avoid, and a pre-ticked radio is the easiest thing in any
 * form to click past.
 */
function AmbiguityPrompt({
  finding,
  onChooseOrder,
}: {
  finding: DateColumnFinding;
  onChooseOrder: (column: string, order: DateOrder) => void;
}) {
  if (finding.inference.status !== "ambiguous") return null;
  const { samples } = finding.inference;
  const groupName = `date-order-${finding.key}`;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {finding.label} values shown under both readings
          </caption>
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">In the file</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Read day first</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Read month first</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((sample) => (
              <tr key={sample.value} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-mono text-xs font-normal">
                  {sample.value}
                </th>
                <td className="px-3 py-2">{describeIsoDate(sample.dmy)}</td>
                <td className="px-3 py-2">{describeIsoDate(sample.mdy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          How were the dates in {finding.label} written?
        </legend>
        <RadioGroup
          name={groupName}
          value={finding.order ?? null}
          onValueChange={(value) => {
            if (value === "dmy" || value === "mdy") onChooseOrder(finding.key, value);
          }}
          className="gap-2"
        >
          {(["dmy", "mdy"] as const).map((order) => (
            <label
              key={order}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5"
            >
              <RadioGroupItem value={order} className="mt-0.5" />
              <span>
                <span className="font-medium">{ORDER_HEADINGS[order]}</span>
                {samples[0] && (
                  <span className="ml-1.5 text-muted-foreground">
                    — “{samples[0].value}” is{" "}
                    {describeIsoDate(order === "dmy" ? samples[0].dmy : samples[0].mdy)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  );
}

function ColumnVerdict({
  finding,
  onChooseOrder,
}: {
  finding: DateColumnFinding;
  onChooseOrder: (column: string, order: DateOrder) => void;
}) {
  const { inference } = finding;

  const tone =
    inference.status === "conflicted" || inference.status === "unusable"
      ? "border-destructive/40 bg-destructive/5"
      : inference.status === "ambiguous" && finding.order === undefined
        ? "border-amber-500/40 bg-amber-500/10"
        : "bg-muted/30";

  return (
    <section className={`space-y-2 rounded-lg border p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        {inference.status === "conflicted" || inference.status === "unusable" ? (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        ) : inference.status === "ambiguous" && finding.order === undefined ? (
          <HelpCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
        ) : (
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-sm font-medium">{finding.label}</h4>

          {inference.status === "resolved" && inference.order && (
            <p className="text-sm">
              Read {ORDER_WORDS[inference.order]}.{" "}
              <span className="text-muted-foreground">
                “{inference.evidence}” in this column can only be read that way, which settles it for
                every row.
              </span>
            </p>
          )}

          {inference.status === "resolved" && inference.order === null && (
            <p className="text-sm">
              No choice needed.{" "}
              <span className="text-muted-foreground">
                Every value is already unambiguous — YYYY-MM-DD dates and Excel date numbers carry
                their own meaning.
              </span>
            </p>
          )}

          {inference.status === "ambiguous" && finding.order != null && (
            <p className="text-sm">
              Reading {ORDER_WORDS[finding.order]}.{" "}
              <span className="text-muted-foreground">
                Your choice — nothing in this column could settle it.
              </span>
            </p>
          )}

          {inference.status === "conflicted" && (
            <p className="text-sm">
              This column was not written to one convention, so no setting reads it correctly.{" "}
              <span className="font-mono text-xs">{inference.dmyEvidence}</span> can only be day
              first and <span className="font-mono text-xs">{inference.mdyEvidence}</span> can only
              be month first. Fix the dates in the file and export it again.
            </p>
          )}

          {inference.status === "unusable" && (
            <p className="text-sm">
              Nothing in this column could be read as a date. Check that the right column was
              exported.
            </p>
          )}

          {inference.status === "empty" && (
            <p className="text-sm text-muted-foreground">Every value in this column is blank.</p>
          )}

          <StatsLine stats={inference.stats} />
          <Samples label="Two-digit years" values={inference.stats.shortYearSamples} />
          <Samples label="Not real dates" values={inference.stats.invalidSamples} />
          <Samples label="Not dates" values={inference.stats.unrecognisedSamples} />
        </div>
      </div>

      {inference.status === "ambiguous" && (
        <AmbiguityPrompt finding={finding} onChooseOrder={onChooseOrder} />
      )}
    </section>
  );
}

export function DateFormatCard({ fileLabel, dates, onChooseOrder }: DateFormatCardProps) {
  if (dates.length === 0) return null;

  const waiting = dates.filter((d) => d.inference.status === "ambiguous" && d.order === undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          {fileLabel} — date columns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {waiting.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              {waiting.length === 1
                ? `${waiting[0].label} has to be settled before this import can run.`
                : `${waiting.length} date columns have to be settled before this import can run.`}{" "}
              Every date in {waiting.length === 1 ? "it" : "them"} reads correctly both ways, so
              nothing in the file can decide it.
            </p>
          </div>
        )}
        {dates.map((finding) => (
          <ColumnVerdict key={finding.key} finding={finding} onChooseOrder={onChooseOrder} />
        ))}
      </CardContent>
    </Card>
  );
}
