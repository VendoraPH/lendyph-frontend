"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, HandCoins, Printer } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate, formatRate, todayISO } from "@/lib/format";
import { timeDepositService } from "@/services";
import type { TimeDeposit } from "@/types";
import { ActionButton } from "../../../_components/action-button";
import { DocumentsMenu } from "../../../_components/documents-menu";
import { timeDepositDocuments } from "@/lib/savings/documents";
import { METHOD_LABELS, actorName, labelOf } from "../../../_lib/savings-rules";
import {
  MATURITY_INSTRUCTION_LABELS,
  canPreterminate,
  canSettle,
  maturityHint,
  pendingApprovalBlocker,
  pendingApprovalText,
  termLabel,
} from "../../../_lib/time-deposit-rules";
import { TdStatusBadge } from "../../_components/td-status-badge";
import { printTimeDepositCertificate } from "../_lib/print-certificate";
import { postMaturityLabel } from "../../_lib/settle-form";
import { PreterminateDialog } from "./preterminate-dialog";
import { SettleDialog } from "./settle-dialog";

export function TimeDepositDetail({ depositId }: { depositId: number }) {
  const router = useRouter();
  const fetcher = useCallback(() => timeDepositService.get(depositId), [depositId]);
  const resource = useApiResource(fetcher);
  const [settling, setSettling] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [printing, setPrinting] = useState(false);

  function print(td: TimeDeposit) {
    setPrinting(true);
    printTimeDepositCertificate(td).then(() => setPrinting(false));
  }

  function settled(next: TimeDeposit | null) {
    // A rollover hands back the new placement; follow it.
    if (next && next.id !== depositId) router.push(`/savings/time-deposits/${next.id}`);
    else resource.refetch();
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/savings/time-deposits" />}>
        <ArrowLeft className="h-4 w-4" /> Time deposits
      </Button>

      <DataState
        resource={resource}
        endpoints={["GET /savings/time-deposits/{id}"]}
        summary="This placement's terms, maturity and certificate will show here once the savings service is connected."
      >
        {(td) => {
          const today = todayISO();
          const settleable = canSettle(td, today);
          const breakable = canPreterminate(td, today);
          const waiting = pendingApprovalText(td);
          const pendingBlock = pendingApprovalBlocker(td);
          return (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{td.certificate_number}</h1>
                    <TdStatusBadge status={td.status} />
                    {waiting && (
                      <Link
                        href="/savings/approvals"
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:underline dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        {waiting}
                      </Link>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <Link href={`/borrowers/${td.borrower_id}`} className="font-medium text-foreground hover:underline">
                      {td.borrower_name ?? "Member"}
                    </Link>
                    {td.borrower_code && ` · ${td.borrower_code}`} · {td.product.name}
                    {td.branch_name && ` · ${td.branch_name}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => print(td)} disabled={printing}>
                    <Printer className="h-4 w-4" /> {printing ? "Preparing…" : "Print certificate"}
                  </Button>
                  <DocumentsMenu documents={timeDepositDocuments(td.status)} subjectId={td.id} />
                  {(td.status === "active" || td.status === "matured") && (
                    <>
                      <ActionButton
                        permission="savings:transact"
                        onClick={() => setSettling(true)}
                        blockedReason={pendingBlock ?? (settleable ? null : `Settles on or after ${formatDate(td.maturity_date)}.`)}
                      >
                        <HandCoins className="h-4 w-4" /> Settle at maturity
                      </ActionButton>
                      {breakable && (
                        <ActionButton
                          permission="savings:close"
                          variant="outline"
                          onClick={() => setBreaking(true)}
                          blockedReason={pendingBlock}
                        >
                          <Ban className="h-4 w-4" /> Pre-terminate
                        </ActionButton>
                      )}
                    </>
                  )}
                </div>
              </div>

              <Figures td={td} today={today} />
              <Terms td={td} />

              <SettleDialog open={settling} deposit={td} onOpenChange={setSettling} onSettled={settled} />
              <PreterminateDialog open={breaking} deposit={td} onOpenChange={setBreaking} onDone={() => resource.refetch()} />
            </>
          );
        }}
      </DataState>
    </div>
  );
}

function Figures({ td, today }: { td: TimeDeposit; today: string }) {
  const hint = maturityHint(td, today);
  const items = [
    { label: "Principal", value: formatCurrency(td.principal), strong: true },
    { label: "Rate · term", value: `${formatRate(td.annual_rate)}% · ${termLabel(td.term_days)}` },
    { label: "Matures on", value: formatDate(td.maturity_date), sub: hint },
    { label: "Amount at maturity", value: formatCurrency(td.maturity_amount) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={`mt-1 tabular-nums ${i.strong ? "text-2xl font-semibold" : "text-xl font-medium"}`}>{i.value}</p>
            {i.sub && <p className="text-xs text-muted-foreground">{i.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Terms({ td }: { td: TimeDeposit }) {
  const rows: [string, React.ReactNode][] = [
    ["Placed on", formatDate(td.placement_date)],
    ["Interest for the term", formatCurrency(td.gross_interest)],
    ["Withholding tax", formatCurrency(td.withholding_tax)],
    ["Net interest", formatCurrency(td.net_interest)],
    ["At maturity", labelOf(MATURITY_INSTRUCTION_LABELS, td.maturity_instruction)],
    ["Early termination rate", td.pretermination_rate == null ? "—" : `${formatRate(td.pretermination_rate)}% a year`],
    ["Withholding tax rate", `${formatRate(td.withholding_tax_rate)}%`],
  ];
  // A rollover has no funding method: the earlier placement funded it.
  if (td.funding_method) rows.push(["Paid by", labelOf(METHOD_LABELS, td.funding_method)]);
  else if (td.rolled_over_from_id) rows.push(["Paid by", "Rolled over from the previous placement"]);
  if (td.post_maturity_interest !== "0.00")
    rows.push([
      postMaturityLabel(td),
      td.post_maturity_interest === null ? "—" : formatCurrency(td.post_maturity_interest),
    ]);
  if (td.payout_account_id)
    rows.push([
      "Maturity paid into",
      <Link key="payout" className="hover:underline" href={`/savings/accounts/${td.payout_account_id}`}>
        {td.payout_account_number ?? "Savings account"}
      </Link>,
    ]);
  if (td.settled_on) rows.push(["Settled on", formatDate(td.settled_on)]);
  if (td.settled_interest != null) rows.push(["Interest paid", formatCurrency(td.settled_interest)]);
  if (td.settled_tax != null) rows.push(["Tax withheld", formatCurrency(td.settled_tax)]);
  if (td.settled_amount != null) rows.push(["Paid to the member", formatCurrency(td.settled_amount)]);
  if (td.rolled_over_from_id)
    rows.push(["Rolled over from", <Link key="from" className="hover:underline" href={`/savings/time-deposits/${td.rolled_over_from_id}`}>Previous placement</Link>]);
  if (td.rolled_over_to_id)
    rows.push(["Rolled over into", <Link key="to" className="hover:underline" href={`/savings/time-deposits/${td.rolled_over_to_id}`}>New placement</Link>]);
  if (td.payout_method) rows.push(["Paid out by", labelOf(METHOD_LABELS, td.payout_method)]);
  if (td.settled_on) rows.push(["Settled by", actorName(td.settled_by)]);
  rows.push(["Placed by", actorName(td.created_by)]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Terms</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b pb-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
