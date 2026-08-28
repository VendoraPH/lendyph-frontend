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
import { ShareCapitalUnavailableNotice } from "@/components/common/share-capital-unavailable-notice";
import { collateralService, collateralTypeService } from "@/services";
import {
  SHARE_CAPITAL_UNAVAILABLE_LABEL,
  getShareCapitalBalance,
  hasShareCapitalBalance,
  type ShareCapitalBalance,
} from "@/utils/share-capital";
import {
  collateralValue,
  sumKnownCollateralValues,
  type CollateralValueRow,
} from "@/utils/collateral-value";
import {
  collateralLock,
  holdersSentence,
  isLocked,
  lockLabel,
} from "@/lib/collateral-lock";
import { formatCurrency } from "@/utils/format";
import type {
  Collateral,
  CollateralType,
  CollateralWithMeta,
} from "@/types";

interface CollateralsTabProps {
  borrowerId: number;
}

export function CollateralsTab({ borrowerId }: CollateralsTabProps) {
  const [rows, setRows] = useState<CollateralValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Null when this member has no share-capital collateral, so no balance was
  // ever needed and there is nothing to warn about.
  const [scBalance, setScBalance] = useState<ShareCapitalBalance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The borrower's loan list is no longer fetched: it was only ever there to
      // derive lock state, and it could not do that correctly. `active_loans`
      // comes back on the collateral rows themselves — and it spans the whole
      // active book, so a collateral this member pledged to somebody else's loan
      // (which the API permits) is now visible here rather than invisible.
      const [collaterals, types] = await Promise.all([
        collateralService.list({ borrower_id: borrowerId }),
        collateralTypeService.list(),
      ]);

      const typeById = new Map(types.map((t) => [t.id, t]));

      const needsBalance = collaterals.some(
        (c: Collateral) =>
          typeById.get(c.collateral_type_id)?.source === "share_capital",
      );
      // Only asked for when a share-capital row is actually present — this is
      // a whole-ledger drain, not a single request.
      const balance = needsBalance
        ? await getShareCapitalBalance(borrowerId)
        : null;
      setScBalance(balance);

      const enriched: CollateralValueRow[] = collaterals.map((c) => {
        const t = typeById.get(c.collateral_type_id);
        return {
          ...c,
          type: t,
          lock: collateralLock(c),
          // A share-capital row is worth the balance, so a balance we could not
          // read leaves it with no value. It used to inherit the old function's
          // `0` fallback, which stated — on a member's own record — that their
          // share capital was worth nothing.
          ...collateralValue(c, t, balance),
        };
      });
      setRows(enriched);
    } catch {
      setRows([]);
      setScBalance(null);
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  useEffect(() => {
    load();
  }, [load]);

  // Rows whose value is unknown are LEFT OUT of the total rather than counted
  // as zero, and the card says how many — a total that quietly absorbs an
  // unknown as 0 is exactly the shape of the bug this replaces.
  const { total: totalValue, unknownCount } = useMemo(
    () => sumKnownCollateralValues(rows),
    [rows],
  );

  const balanceProblem =
    scBalance && !hasShareCapitalBalance(scBalance) ? scBalance : null;

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

      <ShareCapitalUnavailableNotice
        result={balanceProblem}
        consequence="Their share-capital collaterals are shown without a value and left out of the total below."
      />

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
            {unknownCount > 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                Excludes {unknownCount} collateral
                {unknownCount === 1 ? "" : "s"} whose value could not be read.
              </p>
            )}
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
                      {c.value_unknown ? (
                        <span className="text-amber-700 dark:text-amber-500">
                          {SHARE_CAPITAL_UNAVAILABLE_LABEL}
                        </span>
                      ) : (
                        formatCurrency(c.effective_value)
                      )}
                    </TableCell>
                    <TableCell>
                      {isLocked(c.lock) ? (
                        <Badge
                          className={
                            c.lock.state === "unknown"
                              ? "bg-muted text-muted-foreground hover:bg-muted"
                              : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"
                          }
                          title={holdersSentence(c.lock) ?? undefined}
                        >
                          {lockLabel(c.lock)}
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
