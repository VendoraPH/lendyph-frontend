"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaApi } from "@/lib/amla/api";
import { formatDate } from "@/lib/format";
import type { AmlaCalendarEntry } from "@/types/amla";
import type { AmlaNoteAction } from "@/components/amla/amla-note-dialog";

interface Props {
  entries: AmlaCalendarEntry[];
  canAsk: boolean;
  onAsk: (action: AmlaNoteAction) => void;
}

/** The year's days that aren't working days, each with its source and approver. */
export function AmlaCalendarEntries({ entries, canAsk, onAsk }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No holidays or non-reporting days are recorded for this year.</p>;
  }

  function remove(entry: AmlaCalendarEntry) {
    onAsk({
      title: `Ask to remove ${entry.name}?`,
      description: `${entry.kind_words} on ${formatDate(entry.date)}. It stays in the calendar until another AMLA settings holder approves the removal.`,
      label: "Reason",
      required: true,
      confirmLabel: "Ask for approval",
      destructive: true,
      success: "Change asked for",
      failure: "The change couldn't be asked for.",
      run: (reason) => amlaApi.ask({ type: "calendar_remove", entry_id: entry.id, reason: reason.trim() }),
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Day</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Approved by</TableHead>
          {canAsk && (
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{formatDate(entry.date)}</TableCell>
            <TableCell className="whitespace-normal">{entry.name}</TableCell>
            <TableCell>{entry.kind_words}</TableCell>
            <TableCell className="max-w-xs whitespace-normal">{entry.source}</TableCell>
            <TableCell>{entry.approved_by?.name ?? "—"}</TableCell>
            {canAsk && (
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => remove(entry)}>
                  Ask to remove
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
