"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DATA_DICTIONARY,
  TEMPLATE_GUIDELINES,
  TEMPLATE_SHEETS,
} from "@/lib/data-template/template";
import type { DictionaryKey } from "@/lib/data-template/types";

/**
 * The workbook's two reference sheets, read-only.
 *
 * They are reference, not data: nothing downstream reads them, and letting
 * staff edit the list of civil statuses would only produce members whose civil
 * status the importer rejects.
 */

/** Which columns each dictionary governs, so the list is not floating free. */
function columnsUsing(key: DictionaryKey): string[] {
  return TEMPLATE_SHEETS.flatMap((sheet) =>
    sheet.columns
      .filter((c) => c.dictionary === key)
      .map((c) => `${sheet.name} · ${c.header}`)
  );
}

export function DataDictionaryPanel() {
  const entries = Object.entries(DATA_DICTIONARY) as [
    DictionaryKey,
    (typeof DATA_DICTIONARY)[DictionaryKey],
  ][];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The only values these columns accept. They are offered as dropdowns in
        the sheets, so anything typed here is already spelled the way the
        importer expects.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, entry]) => (
          <Card key={key}>
            <CardContent className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-semibold">{entry.label}</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {columnsUsing(key).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entry.values.map((value) => (
                  <Badge key={value} variant="secondary" className="font-normal">
                    {value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function GuidelinesPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Straight from the workbook&apos;s Guidelines sheet. Rules 4 and 6 are the
        two this page checks for you as you type.
      </p>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <ol className="space-y-4">
            {TEMPLATE_GUIDELINES.map((guideline, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-xs font-semibold text-brand-orange">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-2 pt-0.5">
                  <p className="text-sm">{guideline.text}</p>
                  {guideline.points && (
                    <ol className="space-y-1.5 pl-1">
                      {guideline.points.map((point, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <span className="shrink-0 font-medium">
                            {String.fromCharCode(97 + i)}.
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
