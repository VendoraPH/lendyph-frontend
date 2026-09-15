"use client";

import { useEffect, useMemo, useState } from "react";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ShieldCheck } from "lucide-react";
import { collateralService } from "@/services";
import { computeSecurityStatus, securityStatusLabel } from "@/types/collateral";
import type { CollateralType, LoanCollateral } from "@/types";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface LoanCollateralsCardProps {
  loanId: number;
  loanPrincipal: number;
}

interface AttachedRow {
  /**
   * The attached collateral itself. `GET /loans/{id}/collaterals` returns full
   * `CollateralResource` rows, so there is nothing left to look up: the detail
   * fields and `collateral_type` are already here.
   */
  link: LoanCollateral;
  type?: CollateralType;
  /** What the collateral was booked at when attached, from the pivot. */
  snapshotValue: number;
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
        // One request. This used to fetch the collateral-type list plus one
        // `GET /collaterals/{id}` per attachment — and every one of those was
        // `/collaterals/undefined`, because it keyed off a `collateral_id` the
        // payload does not carry. The rows ARE the collaterals, with their type
        // eager-loaded, so both extra round trips were fetching data already in
        // hand.
        const links = await collateralService.listForLoan(loanId);
        if (cancelled) return;
        const enriched: AttachedRow[] = links.map((link) => ({
          link,
          type: link.collateral_type,
          snapshotValue: link.pivot?.snapshot_value ?? link.amount,
        }));
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
    () => rows.reduce((sum, r) => sum + r.snapshotValue, 0),
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
    <CollapsibleCard
      icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      title={
        <>
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
        </>
      }
    >
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
            {rows.map(({ link, type, snapshotValue }) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {type?.name ?? "Unknown"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {link.detail_value ?? `#${link.id}`}
                  </span>
                  {type?.source === "share_capital" && (
                    <span className="text-xs text-muted-foreground">
                      (share capital — value snapshotted at attach)
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(snapshotValue)}
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
    </CollapsibleCard>
  );
}
