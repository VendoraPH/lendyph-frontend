"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import {
  ShieldCheck,
  Plus,
  Search,
  ListFilter,
  PencilLine,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { RouteGuard, PermissionGate } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { ShareCapitalUnavailableNotice } from "@/components/common/share-capital-unavailable-notice";
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
import {
  collateralService,
  collateralTypeService,
} from "@/services";
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
  Borrower,
  Collateral,
  CollateralType,
  CollateralWithMeta,
} from "@/types";

export default function CollateralListingPage() {
  const [collaterals, setCollaterals] = useState<CollateralValueRow[]>([]);
  // How many members' share capital ledgers could not be read in full, and one
  // of them to explain WHY. Their collaterals have no value, as distinct from a
  // value of zero.
  const [unreadableBalances, setUnreadableBalances] = useState(0);
  const [firstUnreadableBalance, setFirstUnreadableBalance] =
    useState<ShareCapitalBalance | null>(null);
  const [types, setTypes] = useState<CollateralType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<CollateralValueRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  // Set only when the member drain gave up with pages outstanding, so the
  // borrower-name lookup below is knowingly short. Null means complete.
  const [memberShortfall, setMemberShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);
  // Members whose nested collateral rows are expanded in the table.
  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // No loan list, and no per-loan attachment fan-out. `GET /collaterals`
      // now carries `active_loans` per row, so the lock question is answered by
      // the one request that fetches the rows. This screen used to issue
      // `1 + ceil(N/100) + N` requests to derive an index that never worked.
      const [collateralRows, typeRows, memberDrain] = await Promise.all([
        collateralService.list(),
        collateralTypeService.list(),
        // members_only: collateral belongs to members, not to applicants.
        // Drained across pages: this used to ask for `per_page: 9999`, which
        // BorrowerController clamps to 100 without saying so, and every member
        // past the hundredth rendered as a bare "Member #<id>".
        borrowerService.listAll({ members_only: 1 }),
      ]);
      const borrowers: Borrower[] = memberDrain.rows;
      setMemberShortfall(
        memberDrain.truncated
          ? { shown: borrowers.length, total: memberDrain.total }
          : null,
      );

      const typeById = new Map(typeRows.map((t) => [t.id, t]));
      const borrowerById = new Map(borrowers.map((b) => [b.id, b]));

      // For share-capital collaterals, pull the live balance once per borrower.
      const scBorrowerIds = new Set<number>();
      for (const c of collateralRows) {
        const t = typeById.get(c.collateral_type_id);
        if (t?.source === "share_capital") scBorrowerIds.add(c.borrower_id);
      }
      const scBalances = new Map<number, ShareCapitalBalance>();
      await Promise.all(
        Array.from(scBorrowerIds).map(async (bid) => {
          scBalances.set(bid, await getShareCapitalBalance(bid));
        }),
      );
      const unreadable = Array.from(scBalances.values()).filter(
        (b) => !hasShareCapitalBalance(b),
      );
      setUnreadableBalances(unreadable.length);
      setFirstUnreadableBalance(unreadable[0] ?? null);

      const enriched: CollateralValueRow[] = collateralRows.map((c) => {
        const t = typeById.get(c.collateral_type_id);
        return {
          ...c,
          type: t,
          borrower_name: borrowerById.get(c.borrower_id)?.full_name,
          // No loan context on this screen, so every active holder counts.
          lock: collateralLock(c),
          // `?? 0` is deliberately gone. A share-capital collateral is worth
          // its member's balance, so an unreadable ledger leaves the row with
          // no value — it used to silently appraise at ₱0.00 and drag the
          // totals down with it.
          ...collateralValue(c, t, scBalances.get(c.borrower_id) ?? null),
        };
      });
      setCollaterals(enriched);
      setTypes(typeRows);
    } catch {
      setUnreadableBalances(0);
      setFirstUnreadableBalance(null);
      toast.error("We couldn't load the collaterals. Please try again.");
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

  // Unknown values are LEFT OUT rather than counted as 0 — a headline total
  // that absorbs an unknown as zero is the same silent wrongness as the
  // clamped ledger it came from.
  const { total: totalValue, unknownCount: unknownInFilter } = useMemo(
    () => sumKnownCollateralValues(filtered),
    [filtered],
  );

  // Group filtered collaterals by member so the listing collapses N
  // rows-per-member into one summary row that expands to show details.
  // Each member group exposes precomputed summary stats (count, total
  // value, tagged count) so the parent row renders without re-summing.
  const groupedByMember = useMemo(() => {
    const map = new Map<
      number,
      {
        borrowerId: number;
        borrowerName: string;
        items: CollateralValueRow[];
        total: number;
        unknownCount: number;
        taggedCount: number;
      }
    >();
    for (const c of filtered) {
      const existing = map.get(c.borrower_id);
      if (existing) {
        existing.items.push(c);
        if (c.value_unknown) existing.unknownCount += 1;
        else existing.total += c.effective_value;
        if (isLocked(c.lock)) existing.taggedCount += 1;
      } else {
        map.set(c.borrower_id, {
          borrowerId: c.borrower_id,
          borrowerName: c.borrower_name ?? `Member #${c.borrower_id}`,
          items: [c],
          total: c.value_unknown ? 0 : c.effective_value,
          unknownCount: c.value_unknown ? 1 : 0,
          taggedCount: isLocked(c.lock) ? 1 : 0,
        });
      }
    }
    // Sort alphabetically by member name for predictable ordering.
    return Array.from(map.values()).sort((a, b) =>
      a.borrowerName.localeCompare(b.borrowerName),
    );
  }, [filtered]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await collateralService.delete(deleting.id);
      toast.success("Collateral deleted");
      setDeleting(null);
      await loadAll();
    } catch (err) {
      notifyError(err, "We couldn't delete this collateral. Please try again.");
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

        <ShareCapitalUnavailableNotice
          result={firstUnreadableBalance}
          memberCount={unreadableBalances}
          consequence="Those collaterals are shown without a value and left out of the totals, so do not appraise against them until they load."
        />

        {memberShortfall && (
          <IncompleteListNotice
            shown={memberShortfall.shown}
            total={memberShortfall.total}
            noun="members"
            consequence="Members whose record could not be loaded are listed by their member number instead of their name."
          />
        )}

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
              {/* Counts `unknown` alongside `held`, deliberately. An unconfirmed
                  lock is not an available collateral, and on a lending co-op
                  over-reporting what is spoken for is the safe direction to be
                  wrong in. The per-row badges still say which is which. */}
              <p className="text-2xl font-bold text-green-600">
                {collaterals.filter((c) => isLocked(c.lock)).length}
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
              {unknownInFilter > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                  Excludes {unknownInFilter} collateral
                  {unknownInFilter === 1 ? "" : "s"} whose share capital balance
                  could not be read.
                </p>
              )}
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-center">Collaterals</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-1"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedByMember.map((group) => {
                    const isExpanded = expandedMembers.has(group.borrowerId);
                    const allTagged =
                      group.taggedCount === group.items.length &&
                      group.items.length > 0;
                    return (
                      <Fragment key={group.borrowerId}>
                        {/* Member summary row */}
                        <TableRow
                          className="cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => toggleMember(group.borrowerId)}
                        >
                          <TableCell className="w-8 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {group.borrowerName}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-mono">
                              {group.items.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {group.unknownCount === group.items.length ? (
                              <span className="font-normal text-amber-700 dark:text-amber-500">
                                {SHARE_CAPITAL_UNAVAILABLE_LABEL}
                              </span>
                            ) : (
                              <>
                                {formatCurrency(group.total)}
                                {group.unknownCount > 0 && (
                                  <span
                                    className="ml-1 font-normal text-amber-700 dark:text-amber-500"
                                    title={`${group.unknownCount} of this member's collaterals have no readable value and are excluded from this total.`}
                                  >
                                    +?
                                  </span>
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            {group.taggedCount === 0 ? (
                              <Badge variant="outline">All available</Badge>
                            ) : allTagged ? (
                              <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                                All tagged ({group.taggedCount})
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                                {group.taggedCount} of {group.items.length} tagged
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>

                        {/* Per-collateral nested rows (visible when expanded) */}
                        {isExpanded &&
                          group.items.map((c) => (
                            <TableRow
                              key={c.id}
                              className="bg-muted/20 hover:bg-muted/30"
                            >
                              <TableCell />
                              <TableCell className="pl-6">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {c.type?.name ?? "Unknown"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {c.detail_value}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell />
                              <TableCell className="text-right text-xs tabular-nums">
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleting(c);
                                      }}
                                      disabled={isLocked(c.lock)}
                                      title={
                                        holdersSentence(c.lock) ??
                                        "Delete"
                                      }
                                      aria-label="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </PermissionGate>
                                  {/* One link per holder. A collateral on two
                                      active loans has two loans worth opening,
                                      and a single arrow could only reach one. */}
                                  {c.lock.holders.map((holder) => (
                                    <Button
                                      key={holder.id}
                                      variant="ghost"
                                      size="icon-sm"
                                      nativeButton={false}
                                      render={
                                        <Link href={`/loans/${holder.id}`} />
                                      }
                                      aria-label={`Go to loan ${holder.loan_account_number ?? `#${holder.id}`}`}
                                    >
                                      <ArrowRight className="h-4 w-4" />
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </Fragment>
                    );
                  })}
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
