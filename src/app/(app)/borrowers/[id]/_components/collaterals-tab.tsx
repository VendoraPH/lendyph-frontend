"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/common";
import {
  collateralService,
  collateralTypeService,
  loanService,
} from "@/services";
import { getShareCapitalBalance } from "@/utils/share-capital";
import { formatCurrency } from "@/utils/format";
import type {
  Collateral,
  CollateralType,
  CollateralWithMeta,
  Loan,
} from "@/types";

interface CollateralsTabProps {
  borrowerId: number;
}

export function CollateralsTab({ borrowerId }: CollateralsTabProps) {
  const [rows, setRows] = useState<CollateralWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [collaterals, types, loanRes] = await Promise.all([
        collateralService.list({ borrower_id: borrowerId }),
        collateralTypeService.list(),
        loanService.list({ borrower_id: borrowerId }),
      ]);

      const loans: Loan[] = Array.isArray(loanRes)
        ? (loanRes as Loan[])
        : ((loanRes as { data?: Loan[] }).data ?? []);

      const typeById = new Map(types.map((t) => [t.id, t]));
      const activeLoanIndex = await collateralService.buildActiveLoanIndex(
        loans.map((l) => ({
          id: l.id,
          status: String(l.status),
          loan_account_number: l.loan_account_number,
        })),
      );

      const needsBalance = collaterals.some(
        (c: Collateral) =>
          typeById.get(c.collateral_type_id)?.source === "share_capital",
      );
      const scBalance = needsBalance
        ? await getShareCapitalBalance(borrowerId)
        : 0;

      const enriched: CollateralWithMeta[] = collaterals.map((c) => {
        const t = typeById.get(c.collateral_type_id);
        const isShareCapital = t?.source === "share_capital";
        const active = activeLoanIndex.get(c.id);
        return {
          ...c,
          type: t,
          active_loan_id: active?.loan_id,
          active_loan_account_number: active?.loan_account_number,
          effective_value: isShareCapital ? scBalance : c.amount,
        };
      });
      setRows(enriched);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalValue = useMemo(
    () => rows.reduce((s, r) => s + r.effective_value, 0),
    [rows],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Collaterals registered to this member.
          </p>
        </div>
        <PermissionGate permission="collaterals:create">
          <Button
            render={
              <Link href={`/collaterals/new?borrower_id=${borrowerId}`} />
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Register New Collateral
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Collaterals
            </p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Effective Value
            </p>
            <p className="text-2xl font-bold tabular-nums text-brand-orange">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No collaterals registered yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Click &quot;Register New Collateral&quot; to add one.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-1"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.type?.name ?? "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.detail_value}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.effective_value)}
                    </TableCell>
                    <TableCell>
                      {c.active_loan_id ? (
                        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                          Tagged to loan{" "}
                          {c.active_loan_account_number ??
                            `#${c.active_loan_id}`}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          render={<Link href={`/collaterals/${c.id}`} />}
                          aria-label="View collateral"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
