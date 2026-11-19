"use client";

import { Building2 } from "lucide-react";
import type { Source } from "../../_lib/executive-data";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { branchRows } from "../../_lib/executive-sections";
import { formatMetric } from "../../_lib/metrics";
import { SectionShell, SourceGate } from "./section-shell";

const dash = (v: number | null, format: "currency" | "count" | "percent") => (v === null ? "—" : formatMetric(v, format));

/** The branch table reads three reports; it waits for the first and shows what any of them sent. */
function combined(...sources: Source<unknown>[]): Source<unknown> {
  if (sources.some((s) => s.state === "ready")) return sources.find((s) => s.state === "ready")!;
  if (sources.some((s) => s.state === "loading")) return { state: "loading" };
  if (sources.every((s) => s.state === "denied")) return { state: "denied" };
  return { state: "error" };
}

export function BranchSection({ data }: { data: ExecutiveData }) {
  const rows = branchRows(readyData(data.balance), readyData(data.efficiency), readyData(data.performance));

  return (
    <SectionShell
      title="Branch Performance"
      icon={<Building2 className="size-4" />}
      note="Outstanding and PAR are as of today; released, collected and collection rate cover the period. A dash means that report did not include the branch."
    >
      <SourceGate source={combined(data.balance, data.efficiency, data.performance)} empty={rows.length === 0} height="h-32">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Performance by branch</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 text-left font-medium">Branch</th>
                <th scope="col" className="py-2 text-right font-medium">Members</th>
                <th scope="col" className="py-2 text-right font-medium">Outstanding</th>
                <th scope="col" className="py-2 text-right font-medium">Released</th>
                <th scope="col" className="py-2 text-right font-medium">Collected</th>
                <th scope="col" className="py-2 text-right font-medium">Collection rate</th>
                <th scope="col" className="py-2 text-right font-medium">PAR 30</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.key} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal">{b.name}</th>
                  <td className="py-1.5 text-right tabular-nums">{dash(b.activeBorrowers, "count")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(b.outstanding, "currency")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(b.released, "currency")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(b.collected, "currency")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(b.collectionRate, "percent")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(b.par, "percent")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SourceGate>
    </SectionShell>
  );
}
