"use client";

import { Users } from "lucide-react";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { officerRows } from "../../_lib/executive-sections";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import { formatMetric, toNumber } from "../../_lib/metrics";
import { Figure, SectionShell, SourceGate } from "./section-shell";

const dash = (v: number | null, format: "currency" | "count" | "percent") => (v === null ? "—" : formatMetric(v, format));

/** Members, releases, and the loan officers' books. */
export function OperationsSection({ data }: { data: ExecutiveData }) {
  const borrowers = readyData(data.borrowers);
  const releases = readyData(data.disbursements);
  const officers = officerRows(readyData(data.performance));

  return (
    <SectionShell
      title="Members & Operations"
      icon={<Users className="size-4" />}
      note="New and repeat members, and releases, cover the selected period. Officer balances are as of today."
    >
      <div className={L.twoUp}>
        <SourceGate source={data.borrowers} height="h-24">
          <div className={`${L.cell} ${L.tiles}`}>
            <Figure label="Active members" value={formatMetric(toNumber(borrowers?.total_active_borrowers), "count")} />
            <Figure label="New members" value={formatMetric(toNumber(borrowers?.new_borrowers), "count")} />
            <Figure label="Repeat members" value={formatMetric(toNumber(borrowers?.repeat_borrowers), "count")} />
            <Figure label="Average loan size" value={formatMetric(toNumber(borrowers?.avg_loan_size), "currency")} />
          </div>
        </SourceGate>
        <SourceGate source={data.disbursements} height="h-24">
          <div className={`${L.cell} ${L.tiles}`}>
            <Figure label="Loans released" value={formatMetric(toNumber(releases?.loans_released), "count")} />
            <Figure label="Net proceeds released" value={formatMetric(toNumber(releases?.total_disbursed), "currency")} />
            <Figure label="Average net proceeds" value={formatMetric(toNumber(releases?.avg_disbursement), "currency")} />
            <Figure label="Awaiting release" value={formatMetric(toNumber(releases?.pending_release), "count")} />
          </div>
        </SourceGate>
      </div>

      <h3 className="mb-2 mt-4 text-sm font-medium">Loan officers (top 10 by outstanding)</h3>
      <SourceGate source={data.performance} empty={officers.length === 0} height="h-32">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Loan officers by outstanding portfolio</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 text-left font-medium">Officer</th>
                <th scope="col" className="py-2 text-right font-medium">Members</th>
                <th scope="col" className="py-2 text-right font-medium">Released</th>
                <th scope="col" className="py-2 text-right font-medium">Collected</th>
                <th scope="col" className="py-2 text-right font-medium">Outstanding</th>
                <th scope="col" className="py-2 text-right font-medium">PAR 30</th>
              </tr>
            </thead>
            <tbody>
              {officers.map((o) => (
                <tr key={o.key} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal">{o.name}</th>
                  <td className="py-1.5 text-right tabular-nums">{dash(o.activeBorrowers, "count")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(o.released, "currency")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(o.collected, "currency")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(o.outstanding, "currency")}</td>
                  <td className="py-1.5 text-right tabular-nums">{dash(o.par, "percent")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SourceGate>
    </SectionShell>
  );
}
