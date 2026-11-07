"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
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
import { useApiResource } from "@/hooks";
import { formatCurrency, formatRate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsProduct } from "@/types";
import { INTEREST_POSTING_LABELS } from "../../_lib/savings-rules";
import { ProductDialog } from "./product-dialog";

export function ProductsScreen() {
  const fetcher = useCallback(() => savingsService.products(), []);
  const resource = useApiResource(fetcher);
  const [editing, setEditing] = useState<SavingsProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<SavingsProduct | null>(null);

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
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/savings" />}>
        <ArrowLeft className="h-4 w-4" /> Savings accounts
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings Products</h1>
          <p className="text-sm text-muted-foreground">
            Interest, minimum balances and dormancy rules for passbook savings.
          </p>
        </div>
        <Button onClick={() => edit(null)}>
          <Plus className="h-4 w-4" /> Add product
        </Button>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/products"]}
        summary="Savings products will be listed here once the backend is connected."
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No savings products yet. Add one before opening accounts."
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Credited</TableHead>
                  <TableHead className="text-right">Min. to open</TableHead>
                  <TableHead className="text-right">Maintaining</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.code}
                        {p.kind === "time_deposit" && " · Time deposit"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatRate(p.annual_interest_rate)}%</TableCell>
                    <TableCell>{INTEREST_POSTING_LABELS[p.interest_posting] ?? p.interest_posting}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.minimum_opening_balance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.maintaining_balance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.account_count ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "secondary" : "outline"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {p.kind === "regular" && (
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => edit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {!p.account_count && (
                          <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataState>

      <ProductDialog open={dialogOpen} product={editing} onOpenChange={setDialogOpen} onSaved={resource.refetch} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only a product with no accounts can be deleted. To retire one that has accounts, edit it and
              switch off &quot;Available for new accounts&quot;.
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
    </div>
  );
}
