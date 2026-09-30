"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import {
  AlertCircle,
  AlertTriangle,
  Construction,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { RouteGuard, PermissionGate, TablePagination } from "@/components/common";
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
import { collateralService } from "@/services";
import type { RegisterCollateral } from "@/types";
import { RegisterSummary } from "./_components/register-summary";
import { RegisterTable } from "./_components/register-table";
import {
  REGISTER_PER_PAGE_OPTIONS,
  useCollateralRegister,
} from "./_hooks/use-collateral-register";
import { ALL_TYPES, REGISTER_SEARCH_MAX } from "./_lib/register";

export default function CollateralListingPage() {
  const register = useCollateralRegister();
  const [deleting, setDeleting] = useState<RegisterCollateral | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  // Members whose nested collateral rows are expanded in the table. Kept here
  // rather than in the table so a reload does not collapse them.
  const [expandedMembers, setExpandedMembers] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const toggleMember = (borrowerId: number) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(borrowerId)) next.delete(borrowerId);
      else next.add(borrowerId);
      return next;
    });
  };

  // Reloads the page on screen rather than starting over; if the delete
  // emptied it, the hook steps back to the nearest page that has rows.
  const handleDelete = () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    collateralService
      .delete(deleting.id)
      .then(() => {
        toast.success("Collateral deleted");
        setDeleting(null);
        register.reload();
      })
      .catch((err: unknown) => {
        notifyError(err, "We couldn't delete this collateral. Please try again.");
      })
      .finally(() => setDeleteSubmitting(false));
  };

  const { data } = register;
  const groups = data?.data ?? [];

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

        {data?.meta.names_hidden && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
          >
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Member names are unavailable
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Your role cannot view member records, so members are listed by
                their member number instead of their name, and search matches
                that number.
              </p>
            </div>
          </div>
        )}

        <RegisterSummary totals={data?.meta.totals ?? null} />

        {/* Filters + Table */}
        <Card>
          <div className="p-6 pb-0 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={register.searchDraft}
                onChange={(e) => register.setSearchDraft(e.target.value)}
                placeholder="Search by member, type, or detail..."
                aria-label="Search collaterals"
                maxLength={REGISTER_SEARCH_MAX}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Select
                value={register.typeFilter}
                onValueChange={register.changeTypeFilter}
              >
                <SelectTrigger className="w-44" aria-label="Filter by collateral type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All types</SelectItem>
                  {register.types.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CardContent className="pt-4">
            {register.loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : register.unavailable ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Construction className="h-10 w-10 text-muted-foreground/50 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-muted-foreground">
                  The collateral register is not connected yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  This server has not been updated with it yet. It will appear
                  here once it is.
                </p>
              </div>
            ) : register.error ? (
              <div
                role="alert"
                className="flex flex-col items-center justify-center gap-3 py-12 text-center"
              >
                <AlertCircle className="h-10 w-10 text-destructive/70" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">
                    We couldn&apos;t load the collaterals
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{register.error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={register.reload}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/50 mb-3" aria-hidden="true" />
                {register.filtered ? (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">
                      No collaterals match
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Try a different search or collateral type.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">
                      No collaterals yet
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Click &quot;New Collateral&quot; to register the first one.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <RegisterTable
                  groups={groups}
                  sort={register.sort}
                  onSortChange={register.changeSort}
                  expanded={expandedMembers}
                  onToggle={toggleMember}
                  onDelete={setDeleting}
                />
                <TablePagination
                  page={register.page}
                  perPage={register.perPage}
                  total={data?.meta.total ?? groups.length}
                  perPageOptions={REGISTER_PER_PAGE_OPTIONS}
                  onPageChange={register.setPage}
                  onPerPageChange={register.changePerPage}
                />
              </>
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
