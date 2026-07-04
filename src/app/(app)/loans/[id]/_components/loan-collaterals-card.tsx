"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ShieldCheck } from "lucide-react";
import { collateralService, collateralTypeService } from "@/services";
import { computeSecurityStatus, securityStatusLabel } from "@/types/collateral";
import type { Collateral, CollateralType, LoanCollateral } from "@/types";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface LoanCollateralsCardProps {
  loanId: number;
  loanPrincipal: number;
}

interface AttachedRow {
  link: LoanCollateral;
  collateral?: Collateral;
  type?: CollateralType;
}

export function LoanCollateralsCard({
  loanId,
  loanPrincipal,
}: LoanCollateralsCardProps) {
  const [rows, setRows] = useState<AttachedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loanId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [links, types] = await Promise.all([
          collateralService.listForLoan(loanId),
          collateralTypeService.list(),
        ]);
        const typeById = new Map(types.map((t) => [t.id, t]));
        const collaterals = await Promise.all(
          links.map((l) =>
            collateralService.detail(l.collateral_id).catch(() => null),
          ),
        );
        if (cancelled) return;
        const enriched: AttachedRow[] = links.map((link, i) => {
          const c = collaterals[i] ?? undefined;
          return {
            link,
            collateral: c ?? undefined,
            type: c ? typeById.get(c.collateral_type_id) : undefined,
          };
        });
        setRows(enriched);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  const totalValue = useMemo(
    () => rows.reduce((sum, r) => sum + r.link.snapshot_value, 0),
    [rows],
  );

  const status = useMemo(
    () =>
      loanPrincipal > 0
        ? computeSecurityStatus(loanPrincipal, totalValue)
        : "unsecured",
    [loanPrincipal, totalValue],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Collaterals
          {!loading && rows.length > 0 && (
            <Badge
              className={cn(
                "ml-1 text-xs font-normal",
                status === "secured" &&
                  "bg-green-500/15 text-green-700 hover:bg-green-500/15",
                status === "partially_secured" &&
                  "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15",
                status === "unsecured" &&
                  "bg-destructive/15 text-destructive hover:bg-destructive/15",
              )}
            >
              {securityStatusLabel(status)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collaterals attached to this loan.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map(({ link, collateral, type }) => (
              <div
                key={link.collateral_id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {type?.name ?? "Unknown"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {collateral?.detail_value ?? `#${link.collateral_id}`}
                  </span>
                  {type?.source === "share_capital" && (
                    <span className="text-xs text-muted-foreground">
                      (share capital — value snapshotted at attach)
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(link.snapshot_value)}
                </span>
              </div>
            ))}

            <div className="mt-3 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Collateral Value
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {formatCurrency(totalValue)}
                </p>
              </div>
              {loanPrincipal > 0 && status !== "secured" && (
                <p className="text-xs text-muted-foreground">
                  Short by{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(Math.max(0, loanPrincipal - totalValue))}
                  </span>{" "}
                  vs. principal
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
