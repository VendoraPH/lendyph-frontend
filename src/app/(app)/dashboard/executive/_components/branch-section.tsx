"use client";

import { Building2 } from "lucide-react";
import type { ExecutiveBranches, ExecutiveFilterKey } from "@/types/executive-dashboard";
import type { EndpointSource } from "../../_hooks/use-executive-endpoints";
import { branchTable } from "../../_lib/executive-overview";
import { SectionShell, SourceGate } from "./section-shell";

/**
 * Branch Performance, from `GET /dashboard/executive/branches`: the server's
 * rows (with a "No branch" row only when it sends one) and its totals, never a
 * sum of the rows. The books columns show only while the books are ready.
 */
export function BranchSection({ source, sentFilters }: { source: EndpointSource<ExecutiveBranches>; sentFilters: ExecutiveFilterKey[] }) {
  const table = source.state === "ready" ? branchTable(source.data, sentFilters) : null;
  const notes = table?.columns.filter((c) => c.note) ?? [];

  return (
    <SectionShell title="Branch Performance" icon={<Building2 className="size-4" />} note={table?.balancesNote}>
      {source.state === "refused" ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" role="alert">
          {source.message}
        </p>
      ) : (
        <SourceGate source={source} empty={(table?.rows.length ?? 0) === 0} height="h-32">
          {table && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{table.updated}</p>
              {/* The scrollbar stays visible (the system's overlay one hides), so the last columns are findable. */}
              <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-muted/40" tabIndex={0} role="region" aria-label="Performance by branch, scrolls sideways">
                <table className="w-full min-w-[960px] text-sm">
                  <caption className="sr-only">Performance by branch</caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <td />
                      {table.groups.map((g) => (
                        <th key={g.label} scope="colgroup" colSpan={g.span} className="border-b px-2 pt-1 text-center font-medium">
                          {g.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <th scope="col" className="py-2 pr-2 text-left font-medium">
                        Branch
                      </th>
                      {table.columns.map((c) => (
                        <th key={c.key} scope="col" className="px-2 py-2 text-right font-medium">
                          {c.header}
                          {c.note ? <span aria-hidden="true">*</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.key} className="border-b last:border-0">
                        <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                          {row.name}
                        </th>
                        {table.columns.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">
                            {row.cells[c.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <th scope="row" className="py-1.5 pr-2 text-left">
                        Total
                      </th>
                      {table.columns.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">
                          {table.totals[c.key]}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {table.booksNote ? <p className="text-xs text-muted-foreground">{table.booksNote}</p> : null}
              {notes.length > 0 ? (
                <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {notes.map((c) => (
                    <li key={c.key}>
                      * {c.header}: {c.note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </SourceGate>
      )}
    </SectionShell>
  );
}
