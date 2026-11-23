"use client";

import { Users } from "lucide-react";
import type { ExecutiveFilterKey, FiltersAppliedTo } from "@/types/executive-dashboard";
import { reportFigureNote } from "../../_lib/executive-books";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { officerRows } from "../../_lib/executive-sections";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import { formatMetric, toNumber } from "../../_lib/metrics";
import { Figure, SectionShell, SourceGate } from "./section-shell";

const dash = (v: number | null, format: "currency" | "count" | "percent") => (v === null ? "—" : formatMetric(v, format));

/** Members, releases, and the loan officers' books. */
/**
 * What a releases or officer figure follows when its report sends no filter
 * list: the product and the officer. The Member Report follows none. A report
 * that sends its own lists (EB-A) is read instead, figure by figure.
 */
const LOAN_FILTERS: ExecutiveFilterKey[] = ["product_id", "officer_id"];

const OFFICER_COLUMNS = [
  ["active_borrowers", "Members"],
  ["released_amount", "Released"],
  ["collected", "Collected"],
  ["total_outstanding", "Outstanding"],
  ["par_ratio", "PAR 30"],
] as const;

export function OperationsSection({ data, sentFilters }: { data: ExecutiveData; sentFilters: ExecutiveFilterKey[] }) {
  const lists = (report: unknown) => report as Partial<FiltersAppliedTo> | null;
  const memberNote = (figure: string) => reportFigureNote(sentFilters, lists(readyData(data.borrowers)), figure, []);
  const releaseNote = (figure: string) => reportFigureNote(sentFilters, lists(readyData(data.disbursements)), figure, LOAN_FILTERS);
  const officerNotes = OFFICER_COLUMNS.map(([field, header]) => ({
    header,
    note: reportFigureNote(sentFilters, lists(readyData(data.performance)), `by_officer.${field}`, LOAN_FILTERS),
  })).filter((c) => c.note !== null);
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
            <Figure label="Active members" value={formatMetric(toNumber(borrowers?.total_active_borrowers), "count")} note={memberNote("total_active_borrowers")} />
            <Figure label="New members" value={formatMetric(toNumber(borrowers?.new_borrowers), "count")} note={memberNote("new_borrowers")} />
            <Figure label="Repeat members" value={formatMetric(toNumber(borrowers?.repeat_borrowers), "count")} note={memberNote("repeat_borrowers")} />
            <Figure label="Average loan size" value={formatMetric(toNumber(borrowers?.avg_loan_size), "currency")} note={memberNote("avg_loan_size")} />
          </div>
        </SourceGate>
        <SourceGate source={data.disbursements} height="h-24">
          <div className={`${L.cell} ${L.tiles}`}>
            <Figure label="Loans released" value={formatMetric(toNumber(releases?.loans_released), "count")} note={releaseNote("loans_released")} />
            <Figure label="Net proceeds released" value={formatMetric(toNumber(releases?.total_disbursed), "currency")} note={releaseNote("total_disbursed")} />
            <Figure label="Average net proceeds" value={formatMetric(toNumber(releases?.avg_disbursement), "currency")} note={releaseNote("avg_disbursement")} />
            <Figure label="Awaiting release" value={formatMetric(toNumber(releases?.pending_release), "count")} note={releaseNote("pending_release")} />
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
        {officerNotes.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            {officerNotes.map((c) => (
              <li key={c.header}>
                {c.header}: {c.note}
              </li>
            ))}
          </ul>
        ) : null}
      </SourceGate>
    </SectionShell>
  );
}
