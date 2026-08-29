"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateISO, formatDateObj } from "@/lib/format";

export interface DateRangeFilterProps {
  /** Caption rendered before the pickers. Omitted leaves the pair uncaptioned. */
  label?: string;
  /** `YYYY-MM-DD`, or null for an open end. */
  from: string | null;
  to: string | null;
  /**
   * Always both ends, never one: moving `from` past the current `to` clears the
   * `to`, and a caller that only received the changed end would keep an
   * impossible window and ask the server for zero rows.
   */
  onChange: (from: string | null, to: string | null) => void;
  className?: string;
}

/**
 * A from/to pair of single-date calendars for a server-side date window.
 *
 * Talks `YYYY-MM-DD` on both sides rather than `Date`, because that is what
 * every list endpoint's `date_from`/`date_to` wants and what a dependency array
 * can hold: a `Date` re-parsed on each render is a new object every time, which
 * would re-trigger the fetch effect that reads it forever.
 *
 * The window it describes is whatever the endpoint applies — this component
 * only carries the two endpoints across and never shifts them by a day to make
 * a boundary come out inclusive or exclusive. A caller that needs different
 * boundary semantics than its API has must say so in `label`, not here.
 */
export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
  className,
}: DateRangeFilterProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Parsed at the `T00:00:00` local midnight the string names. `new Date("…")`
  // on a bare date reads it as UTC, which lands the calendar on the previous
  // day for every timezone behind it — Manila is ahead, so the selected cell
  // would be right here and wrong for anyone running this elsewhere.
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T00:00:00`) : undefined;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {label ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      ) : null}

      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={fromDate ? `From date: ${formatDateObj(fromDate)}` : "From date"}
              className={cn(
                "flex h-9 w-full sm:w-36 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !from && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {fromDate ? formatDateObj(fromDate) : "From"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={fromDate}
            onSelect={(d) => {
              const nextFrom = d ? formatDateISO(d) : null;
              // A `to` now before the `from` describes no days at all. Drop it
              // rather than sending the server a window it can only answer
              // empty, which reads on screen as "there are no such events".
              const nextTo = nextFrom && to && to < nextFrom ? null : to;
              onChange(nextFrom, nextTo);
              setFromOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={toDate ? `To date: ${formatDateObj(toDate)}` : "To date"}
              className={cn(
                "flex h-9 w-full sm:w-36 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !to && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {toDate ? formatDateObj(toDate) : "To"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={toDate}
            // The `from` guard above handles the other direction; this one just
            // stops the impossible pick being made in the first place.
            disabled={fromDate ? (d) => d < fromDate : undefined}
            onSelect={(d) => {
              onChange(from, d ? formatDateISO(d) : null);
              setToOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
