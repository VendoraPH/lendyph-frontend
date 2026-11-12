"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService, timeDepositService } from "@/services";
import { AccountStatusBadge } from "@/app/(app)/savings/_components/account-status-badge";
import { Kpi } from "@/app/(app)/savings/_components/kpi";
import { termLabel } from "@/app/(app)/savings/_lib/time-deposit-rules";
import { TdStatusBadge } from "@/app/(app)/savings/time-deposits/_components/td-status-badge";
import { savingsTabCards } from "../_lib/savings-tab-view";

/** One page holds them all for a member; a longer list says it's short. */
const PER_PAGE = 100;

/**
 * The member's savings (gap round, behind the savings flag and
 * `savings:view`): the server's totals, each account with its balance and
 * available balance, and the time deposits. Nothing is added up here.
 */
export function SavingsTab({ borrowerId }: { borrowerId: number }) {
  const fetchAccounts = useCallback(
    () => savingsService.accounts({ borrower_id: borrowerId, per_page: PER_PAGE }),
    [borrowerId],
  );
  const fetchDeposits = useCallback(
    () => timeDepositService.list({ borrower_id: borrowerId, per_page: PER_PAGE }),
    [borrowerId],
  );
  const accounts = useApiResource(fetchAccounts);
  const deposits = useApiResource(fetchDeposits);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {savingsTabCards(accounts.data?.meta, deposits.data?.meta).map((card) => (
          <Kpi key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <section aria-labelledby="member-savings-accounts" className="space-y-2">
        <h2 id="member-savings-accounts" className="text-base font-semibold">
          Savings accounts
        </h2>
        <DataState
          resource={accounts}
          endpoints={["GET /savings/accounts"]}
          summary="The member's savings accounts will be listed here."
          isEmpty={(res) => res.data.length === 0}
          emptyMessage="This member has no savings accounts."
        >
          {(res) => (
            <div className="space-y-2">
              {res.meta.total > res.data.length && (
                <IncompleteListNotice
                  shown={res.data.length}
                  total={res.meta.total}
                  noun="accounts"
                  consequence="The totals above still cover every account."
                />
              )}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account no.</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead>Last activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          <Link href={`/savings/accounts/${a.id}`} className="hover:underline">
                            {a.account_number}
                          </Link>
                        </TableCell>
                        <TableCell>{a.product?.name ?? "—"}</TableCell>
                        <TableCell>
                          <AccountStatusBadge status={a.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(a.balance)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(a.available_balance)}</TableCell>
                        <TableCell>{a.last_member_activity_on ? formatDate(a.last_member_activity_on) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DataState>
      </section>

      <section aria-labelledby="member-time-deposits" className="space-y-2">
        <h2 id="member-time-deposits" className="text-base font-semibold">
          Time deposits
        </h2>
        <DataState
          resource={deposits}
          endpoints={["GET /savings/time-deposits"]}
          summary="The member's time deposits will be listed here."
          isEmpty={(res) => res.data.length === 0}
          emptyMessage="This member has no time deposits."
        >
          {(res) => (
            <div className="space-y-2">
              {res.meta.total > res.data.length && (
                <IncompleteListNotice
                  shown={res.data.length}
                  total={res.meta.total}
                  noun="time deposits"
                  consequence="The counts above still cover every time deposit."
                />
              )}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">At maturity</TableHead>
                      <TableHead>Matures</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((td) => (
                      <TableRow key={td.id}>
                        <TableCell className="font-medium">
                          <Link href={`/savings/time-deposits/${td.id}`} className="hover:underline">
                            {td.certificate_number}
                          </Link>
                        </TableCell>
                        <TableCell>{td.product?.name ?? "—"}</TableCell>
                        <TableCell>{termLabel(td.term_days)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(td.principal)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(td.maturity_amount)}</TableCell>
                        <TableCell>{formatDate(td.maturity_date)}</TableCell>
                        <TableCell>
                          <TdStatusBadge status={td.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DataState>
      </section>
    </div>
  );
}
