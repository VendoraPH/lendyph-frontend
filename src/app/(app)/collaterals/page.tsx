"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Search,
  ListFilter,
  PencilLine,
  Trash2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { RouteGuard, PermissionGate } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
import { borrowerService } from "@/services/borrower.service";
import { loanService } from "@/services/loan.service";
import {
  collateralService,
  collateralTypeService,
} from "@/services";
import { getShareCapitalBalance } from "@/utils/share-capital";
import { formatCurrency } from "@/utils/format";
import type {
  Borrower,
  Collateral,
  CollateralType,
  CollateralWithMeta,
  Loan,
} from "@/types";

export default function CollateralListingPage() {
  const [collaterals, setCollaterals] = useState<CollateralWithMeta[]>([]);
  const [types, setTypes] = useState<CollateralType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<CollateralWithMeta | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [collateralRows, typeRows, borrowerRes, loanRes] =
        await Promise.all([
          collateralService.list(),
          collateralTypeService.list(),
          borrowerService.list(),
          loanService.list(),
        ]);
      const borrowers: Borrower[] = Array.isArray(borrowerRes)
        ? (borrowerRes as Borrower[])
        : ((borrowerRes as { data?: Borrower[] }).data ?? []);
      const loans: Loan[] = Array.isArray(loanRes)
        ? (loanRes as Loan[])
        : ((loanRes as { data?: Loan[] }).data ?? []);

      const typeById = new Map(typeRows.map((t) => [t.id, t]));
      const borrowerById = new Map(borrowers.map((b) => [b.id, b]));
      const activeLoanIndex = await collateralService.buildActiveLoanIndex(
        loans.map((l) => ({
          id: l.id,
          status: String(l.status),
          loan_account_number: l.loan_account_number,
        })),
      );

      // For share-capital collaterals, pull the live balance once per borrower.
      const scBorrowerIds = new Set<number>();
      for (const c of collateralRows) {
        const t = typeById.get(c.collateral_type_id);
        if (t?.source === "share_capital") scBorrowerIds.add(c.borrower_id);
      }
      const scBalances = new Map<number, number>();
      await Promise.all(
        Array.from(scBorrowerIds).map(async (bid) => {
          const bal = await getShareCapitalBalance(bid);
          scBalances.set(bid, bal);
        }),
      );

      const enriched: CollateralWithMeta[] = collateralRows.map((c) => {
        const t = typeById.get(c.collateral_type_id);
        const isShareCapital = t?.source === "share_capital";
        const effective_value = isShareCapital
          ? (scBalances.get(c.borrower_id) ?? 0)
          : c.amount;
        const active = activeLoanIndex.get(c.id);
        return {
          ...c,
          type: t,
          borrower_name: borrowerById.get(c.borrower_id)?.full_name,
          active_loan_id: active?.loan_id,
          active_loan_account_number: active?.loan_account_number,
          effective_value,
        };
      });
      setCollaterals(enriched);
      setTypes(typeRows);
    } catch {
      toast.error("Failed to load collaterals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    return collaterals.filter((c) => {
      if (typeFilter !== "all" && String(c.collateral_type_id) !== typeFilter) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          (c.borrower_name ?? "").toLowerCase().includes(q) ||
          c.detail_value.toLowerCase().includes(q) ||
          (c.type?.name ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [collaterals, search, typeFilter]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, c) => sum + c.effective_value, 0),
    [filtered],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await collateralService.delete(deleting.id);
      toast.success("Collateral deleted");
      setDeleting(null);
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast.error(msg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <RouteGuard permission="collaterals:view" pageName="Collateral Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Collateral Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Register and track collaterals tagged to members and loans.
            </p>
          </div>
          <PermissionGate permission="collaterals:create">
            <Button nativeButton={false} render={<Link href="/collaterals/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              New Collateral
            </Button>
          </PermissionGate>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Collaterals
                  </p>
                  <p className="text-2xl font-bold">{collaterals.length}</p>
                </div>
                <div className="rounded-full bg-brand-blue/10 p-2.5">
                  <ShieldCheck className="h-5 w-5 text-brand-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">
                Tagged to Active Loans
              </p>
              <p className="text-2xl font-bold text-green-600">
                {collaterals.filter((c) => c.active_loan_id).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">
                Total Appraised Value (filtered)
              </p>
              <p className="text-2xl font-bold tabular-nums text-brand-orange">
                {formatCurrency(totalValue)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Table */}
        <Card>
          <div className="p-6 pb-0 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by member, type, or detail..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v ?? "all")}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No collaterals yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click &quot;New Collateral&quot; to register the first one.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-1"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.borrower_name ?? `Member #${c.borrower_id}`}
                      </TableCell>
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
                          <PermissionGate permission="collaterals:update">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              nativeButton={false}
                              render={
                                <Link href={`/collaterals/${c.id}`} />
                              }
                              aria-label="Edit"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="collaterals:delete">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleting(c)}
                              disabled={Boolean(c.active_loan_id)}
                              title={
                                c.active_loan_id
                                  ? "Cannot delete — currently tagged to an active loan"
                                  : "Delete"
                              }
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          {c.active_loan_id && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              render={
                                <Link
                                  href={`/loans/${c.active_loan_id}`}
                                />
                              }
                              aria-label="Go to loan"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deleting)}
          onOpenChange={(o) => !o && setDeleting(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this collateral?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove it from the member&apos;s registered
                collaterals. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  );
}
