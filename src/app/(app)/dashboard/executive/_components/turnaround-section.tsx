"use client";

import { Timer } from "lucide-react";
import type { ExecutiveFilterKey, ExecutiveTurnaround } from "@/types/executive-dashboard";
import type { EndpointSource } from "../../_hooks/use-executive-endpoints";
import { figureFilterNote, turnaroundRows } from "../../_lib/executive-books";
import { SectionShell, SourceGate } from "./section-shell";

/**
 * Application turnaround, from `GET /dashboard/executive/turnaround`: the
 * server's average and median days for each stretch, over the loans that
 * finished it in the period.
 */
export function TurnaroundSection({ source, sentFilters }: { source: EndpointSource<ExecutiveTurnaround>; sentFilters: ExecutiveFilterKey[] }) {
  const response = source.state === "ready" ? source.data : null;
  const rows = response ? turnaroundRows(response) : [];
  const filterNote = response ? figureFilterNote(sentFilters, response, "turnaround") : null;

  return (
    <SectionShell title="Application Turnaround" icon={<Timer className="size-4" />} note="Days are counted over the loans that finished each stretch in the period.">
      {source.state === "refused" ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" role="alert">
          {source.message}
        </p>
      ) : (
        <SourceGate source={source} height="h-24">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Application turnaround</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 text-left font-medium">Stretch</th>
                  <th scope="col" className="py-2 text-right font-medium">Average</th>
                  <th scope="col" className="py-2 text-right font-medium">Median</th>
                  <th scope="col" className="py-2 text-right font-medium">Loans</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b last:border-0">
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {r.label}
                      {r.note ? <span className="block text-[11px] text-muted-foreground">{r.note}</span> : null}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">{r.average}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.median}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.loans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filterNote ? <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">{filterNote}</p> : null}
        </SourceGate>
      )}
    </SectionShell>
  );
}
