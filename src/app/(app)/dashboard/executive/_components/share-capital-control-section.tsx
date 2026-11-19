"use client";

import { Scale } from "lucide-react";
import type { ShareCapitalControl } from "@/types/executive-dashboard";
import type { EndpointSource } from "../../_hooks/use-executive-endpoints";
import { shareCapitalControlTable } from "../../_lib/executive-books";
import { SectionShell, SourceGate } from "./section-shell";

/**
 * The share capital control, from `GET /dashboard/executive/share-capital-control`:
 * the share capital subledger against its account, by branch, as of today,
 * with the server's totals. Needs accounting:view and share_capital:view.
 */
export function ShareCapitalControlSection({ source }: { source: EndpointSource<ShareCapitalControl> }) {
  const table = source.state === "ready" ? shareCapitalControlTable(source.data) : null;

  return (
    <SectionShell title="Share Capital Control" icon={<Scale className="size-4" />} note={table?.summary}>
      {source.state === "refused" ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" role="alert">
          {source.message}
        </p>
      ) : (
        <SourceGate source={source} height="h-24">
          {table && (
            <div className="space-y-2">
              {table.notice ? <p className="text-sm text-muted-foreground">{table.notice}</p> : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Share capital subledger against {table.account ?? "its account"}, by branch</caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th scope="col" className="py-2 text-left font-medium">Branch</th>
                      <th scope="col" className="py-2 text-right font-medium">Subledger</th>
                      <th scope="col" className="py-2 text-right font-medium">{table.account ?? "Books"}</th>
                      <th scope="col" className="py-2 text-right font-medium">Difference</th>
                      <th scope="col" className="py-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r) => (
                      <tr key={r.key} className="border-b last:border-0">
                        <th scope="row" className="py-1.5 text-left font-normal">{r.name}</th>
                        <td className="py-1.5 text-right tabular-nums">{r.subledger}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.books}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.difference}</td>
                        <td className="py-1.5 text-right">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <th scope="row" className="py-1.5 text-left">Total</th>
                      <td className="py-1.5 text-right tabular-nums">{table.totals.subledger}</td>
                      <td className="py-1.5 text-right tabular-nums">{table.totals.books}</td>
                      <td className="py-1.5 text-right tabular-nums">{table.totals.difference}</td>
                      <td className="py-1.5 text-right">{table.totals.status}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </SourceGate>
      )}
    </SectionShell>
  );
}
