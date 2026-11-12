import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { AutoCreditRunLine, SavingsAutoCreditRunResult } from "@/types/savings-servicing";
import { Kpi } from "../../_components/kpi";
import { runHeadline, runLineAccount, runTotalCards } from "../_lib/run-view";

function AccountCell({ line }: { line: AutoCreditRunLine }) {
  const { account, member } = runLineAccount(line);
  return (
    <TableCell>
      <Link href={`/savings/accounts/${line.account_id}`} className="font-mono text-xs hover:underline">
        {account}
      </Link>
      <span className="block text-xs text-muted-foreground">{member}</span>
    </TableCell>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">({count})</span>
      </h3>
      <div className="overflow-x-auto rounded-lg border">{children}</div>
    </section>
  );
}

/** A run's plan or result, every figure and reason as the server sent it. */
export function RunResult({ result, posted }: { result: SavingsAutoCreditRunResult; posted: boolean }) {
  const nothing = [result.credits, result.skipped, result.already_credited].every((rows) => rows.length === 0);
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm text-muted-foreground">{runHeadline(result, posted)}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {runTotalCards(result, posted).map((c) => (
          <Kpi key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
      {nothing && (
        <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
          No active instruction is due on this cycle in your branches.
        </p>
      )}
      <Section title={posted ? "Credited" : "To credit"} count={result.credits.length}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.credits.map((c) => (
              <TableRow key={c.instruction_id}>
                <AccountCell line={c} />
                <TableCell className="font-mono text-xs">{c.reference ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(c.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section title="Skipped" count={result.skipped.length}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Why</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.skipped.map((s) => (
              <TableRow key={s.instruction_id}>
                <AccountCell line={s} />
                <TableCell className="max-w-md whitespace-normal text-sm">{s.reason}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section title="Already credited this cycle" count={result.already_credited.length}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.already_credited.map((a) => (
              <TableRow key={a.instruction_id}>
                <AccountCell line={a} />
                <TableCell>
                  <Badge variant={a.status === "reversed" ? "destructive" : "secondary"}>{a.status_label}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{a.reference ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(a.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      {result.already_credited.some((a) => a.status === "reversed") && (
        <p className="text-xs text-muted-foreground">
          A credit that was reversed is never credited again by a run. If the money is still owed, post a deposit on
          the account.
        </p>
      )}
    </div>
  );
}
