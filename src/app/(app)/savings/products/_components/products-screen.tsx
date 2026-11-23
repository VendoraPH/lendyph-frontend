"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Percent, Pencil, Plus, Trash2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { formatCurrency, formatRate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { companyWideBlocker } from "@/lib/savings/company-wide";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { savingsService } from "@/services";
import type { SavingsProduct } from "@/types";
import { INTEREST_CREDITING_LABELS, PRODUCT_KIND_LABELS, labelOf } from "../../_lib/savings-rules";
import { termLabel } from "../../_lib/time-deposit-rules";
import { ACCOUNT_STATUS_TONE } from "../../_components/account-status-badge";
import { ActionButton } from "@/app/(app)/savings/_components/action-button";
import { ladderLines, rateTermLabel } from "../_lib/rate-draft";
import { ProductDialog } from "./product-dialog";
import { RatesDialog } from "./rates-dialog";

/**
 * The savings products and their rates. Company-wide: adding, editing (turning
 * a product on or off included), deleting and adding rates need
 * savings:settings and branches:view_all; anyone else reads them, with the reason.
 */
export function ProductsScreen() {
  const blocker = companyWideBlocker(usePermission().can, "products");
  const fetcher = useCallback(() => savingsService.products(), []);
  const resource = useApiResource(fetcher);
  const [editing, setEditing] = useState<SavingsProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<SavingsProduct | null>(null);
  const [ratesFor, setRatesFor] = useState<SavingsProduct | null>(null);

  const edit = (p: SavingsProduct | null) => {
    setEditing(p);
    setDialogOpen(true);
  };

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    savingsService
      .deleteProduct(target.id)
      .then(() => {
        notifySuccess("Product deleted", target.name);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't delete the product."))
      .then(() => setDeleting(null));
  }

  return (
    <PageFill>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 self-start"
        nativeButton={false}
        render={<Link href="/savings" />}
      >
        <ArrowLeft className="h-4 w-4" /> Savings accounts
      </Button>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings Products</h1>
          <p className="text-sm text-muted-foreground">
            Rates by term, minimum balances and rules for passbook savings and time deposits. A product can be
            turned on once the savings books are set up in Accounting.
          </p>
          {blocker && <p className="mt-1 text-xs text-muted-foreground">{blocker}</p>}
        </div>
        <ActionButton permission="savings:settings" onClick={() => edit(null)} blockedReason={blocker}>
          <Plus className="h-4 w-4" /> Add product
        </ActionButton>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/products"]}
        summary="Savings products will be listed here once the savings service is connected."
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No savings products yet. Add one before opening accounts."
      >
        {(rows) => (
          <div className={cn("rounded-lg border bg-card", FIT_CLASSES.section)}>
            <ScrollBox>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Rates today</TableHead>
                    <TableHead>Credited</TableHead>
                    <TableHead className="text-right">Min. to open</TableHead>
                    <TableHead className="text-right">Maintaining</TableHead>
                    <TableHead className="text-right">Accounts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.code} · {labelOf(PRODUCT_KIND_LABELS, p.kind)}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {p.current_rates.length === 0
                          ? "—"
                          : p.kind === "time_deposit"
                            ? p.current_rates.map((r) => (
                                <span key={`${r.term_days ?? "all"}`} className="block whitespace-nowrap">
                                  {`${rateTermLabel(r.term_days)}: `}
                                  {formatRate(r.annual_rate)}%
                                </span>
                              ))
                            : p.current_rates.flatMap((r) =>
                                ladderLines(r.tiers?.length ? r.tiers : [{ min_balance: null, annual_rate: r.annual_rate }]).map(
                                  (line) => (
                                    <span key={line} className="block whitespace-nowrap">
                                      {line}
                                    </span>
                                  ),
                                ),
                              )}
                      </TableCell>
                      <TableCell>
                        {p.kind === "time_deposit"
                          ? `At maturity · ${(p.term_options_days ?? []).map(termLabel).join(", ") || "no terms"}`
                          : labelOf(INTEREST_CREDITING_LABELS, p.interest_crediting)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.minimum_opening_balance)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.kind === "time_deposit" ? "—" : formatCurrency(p.maintaining_balance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.account_count}</TableCell>
                      <TableCell>
                        {/* The accounts' colours: Active green, Inactive grey like a closed account. */}
                        <Badge
                          variant="secondary"
                          className={cn("border-0", ACCOUNT_STATUS_TONE[p.is_active ? "active" : "closed"])}
                        >
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Rates of ${p.name}`} onClick={() => setRatesFor(p)}>
                            <Percent className="h-4 w-4" />
                          </Button>
                          <ActionButton
                            permission="savings:settings"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => edit(p)}
                            blockedReason={blocker}
                          >
                            <Pencil className="h-4 w-4" />
                          </ActionButton>
                          {p.can_delete && (
                            <ActionButton
                              permission="savings:settings"
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${p.name}`}
                              onClick={() => setDeleting(p)}
                              blockedReason={blocker}
                            >
                              <Trash2 className="h-4 w-4" />
                            </ActionButton>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollBox>
          </div>
        )}
      </DataState>

      <ProductDialog
        open={dialogOpen}
        product={editing}
        products={resource.data ?? []}
        onOpenChange={setDialogOpen}
        onSaved={resource.refetch}
      />
      <RatesDialog
        product={ratesFor ? ((resource.data ?? []).find((p) => p.id === ratesFor.id) ?? ratesFor) : null}
        onOpenChange={(open) => !open && setRatesFor(null)}
        onAdded={resource.refetch}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only a product with no accounts or time deposits can be deleted. To retire one that has them, edit it
              and switch off &quot;Available for new accounts&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFill>
  );
}
