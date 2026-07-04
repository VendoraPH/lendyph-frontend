"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Trash2,
  UserX,
} from "lucide-react";
import type { Borrower } from "@/types";
import { statusBadgeColor, formatCurrency, getInitials } from "./utils";
import { BorrowerActionsCell } from "./borrower-actions";

interface BorrowerTableProps {
  borrowers: Borrower[];
  onToggleStatus: (id: number) => void;
  onDelete: (id: number) => void;
  onBulkDeactivate: (ids: number[]) => void;
  onBulkDelete: (ids: number[]) => void;
  /** Resolves a branch name when the list payload omits the nested relation. */
  branchNameById?: Map<number, string>;
}

type SortKey =
  | "full_name"
  | "status";
type SortDirection = "asc" | "desc" | null;

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

type ToggleableColumn = "contact" | "branch" | "email" | "income";

const TOGGLEABLE_COLUMNS: { key: ToggleableColumn; label: string }[] = [
  { key: "contact", label: "Contact" },
  { key: "branch", label: "Branch" },
  { key: "email", label: "Email" },
  { key: "income", label: "Income" },
];

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc")
    return <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
  if (direction === "desc")
    return <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground/50" />;
}

export function BorrowerTable({
  borrowers,
  onToggleStatus,
  onDelete,
  onBulkDeactivate,
  onBulkDelete,
  branchNameById,
}: BorrowerTableProps) {
  const router = useRouter();

  // Sorting state
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<
    Record<ToggleableColumn, boolean>
  >({
    contact: true,
    branch: true,
    email: true,
    income: true,
  });

  // Handle sort toggle: asc -> desc -> none
  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: null, direction: null };
      return { key, direction: "asc" };
    });
  }

  function getSortDirection(key: SortKey): SortDirection {
    return sort.key === key ? sort.direction : null;
  }

  // Sort borrowers
  const sortedBorrowers = useMemo(() => {
    if (!sort.key || !sort.direction) return borrowers;

    const sorted = [...borrowers].sort((a, b) => {
      const key = sort.key!;
      let aVal: string | number = a[key] ?? "";
      let bVal: string | number = b[key] ?? "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [borrowers, sort]);

  // Selection helpers
  const allSelected =
    sortedBorrowers.length > 0 &&
    sortedBorrowers.every((b) => selectedIds.has(b.id));
  const someSelected =
    sortedBorrowers.some((b) => selectedIds.has(b.id)) && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedBorrowers.map((b) => b.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Column visibility toggle
  function toggleColumn(col: ToggleableColumn) {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  }

  const selectedCount = selectedIds.size;
  const selectedArray = Array.from(selectedIds);

  // Count visible columns for empty state colspan
  const visibleCount =
    2 + // checkbox + borrower (always visible)
    (visibleColumns.contact ? 1 : 0) +
    (visibleColumns.branch ? 1 : 0) +
    (visibleColumns.email ? 1 : 0) +
    (visibleColumns.income ? 1 : 0) +
    2; // status + actions (always visible)

  return (
    <div className="space-y-2">
      {/* Toolbar: column visibility + bulk actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onBulkDeactivate(selectedArray);
                  setSelectedIds(new Set());
                }}
              >
                <UserX data-icon="inline-start" />
                Deactivate Selected
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onBulkDelete(selectedArray);
                  setSelectedIds(new Set());
                }}
              >
                <Trash2 data-icon="inline-start" />
                Delete Selected
              </Button>
            </>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TOGGLEABLE_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns[col.key]}
                  onCheckedChange={() => toggleColumn(col.key)}
                  closeOnClick={false}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                  onClick={() => handleSort("full_name")}
                >
                  Member
                  <SortIcon direction={getSortDirection("full_name")} />
                </button>
              </TableHead>
              {visibleColumns.contact && <TableHead>Contact</TableHead>}
              {visibleColumns.branch && <TableHead>Branch</TableHead>}
              {visibleColumns.email && <TableHead>Email</TableHead>}
              {visibleColumns.income && <TableHead className="text-right">Income</TableHead>}
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                  onClick={() => handleSort("status")}
                >
                  Status
                  <SortIcon direction={getSortDirection("status")} />
                </button>
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBorrowers.map((borrower) => (
              <TableRow
                key={borrower.id}
                className={`cursor-pointer hover:bg-muted/50 ${
                  selectedIds.has(borrower.id) ? "bg-muted/30" : ""
                }`}
                onClick={() => router.push(`/borrowers/${borrower.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(borrower.id)}
                    onCheckedChange={() => toggleSelect(borrower.id)}
                    aria-label={`Select ${borrower.full_name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      {borrower.photo ? (
                        <AvatarImage
                          src={borrower.photo}
                          alt={borrower.full_name}
                        />
                      ) : null}
                      <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xs font-semibold">
                        {getInitials(borrower.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{borrower.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {borrower.borrower_code}
                      </p>
                    </div>
                  </div>
                </TableCell>
                {visibleColumns.contact && (
                  <TableCell className="text-muted-foreground">
                    {borrower.contact_number || "\u2014"}
                  </TableCell>
                )}
                {visibleColumns.branch && (
                  <TableCell className="text-muted-foreground">
                    {borrower.branch?.name ||
                      (borrower.branch_id != null
                        ? branchNameById?.get(borrower.branch_id)
                        : undefined) ||
                      "\u2014"}
                  </TableCell>
                )}
                {visibleColumns.email && (
                  <TableCell className="text-muted-foreground">
                    {borrower.email || "\u2014"}
                  </TableCell>
                )}
                {visibleColumns.income && (
                  <TableCell className="text-right tabular-nums text-brand-orange font-medium">
                    {borrower.monthly_income
                      ? formatCurrency(Number(borrower.monthly_income))
                      : "\u2014"}
                  </TableCell>
                )}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={statusBadgeColor[borrower.status]}
                  >
                    {borrower.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <BorrowerActionsCell
                    borrower={borrower}
                    onToggleStatus={() => onToggleStatus(borrower.id)}
                    onDelete={() => onDelete(borrower.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {sortedBorrowers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={visibleCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  No borrowers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
