"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  PencilLine,
  Trash2,
} from "lucide-react";
import { PermissionGate } from "@/components/common";
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
import { cn } from "@/lib/utils";
import { collateralLock, holdersSentence, isLocked, lockLabel } from "@/lib/collateral-lock";
import { SHARE_CAPITAL_UNAVAILABLE_LABEL } from "@/utils/share-capital";
import { formatCurrency } from "@/utils/format";
import type {
  CollateralRegisterGroup,
  CollateralRegisterSort,
  RegisterCollateral,
} from "@/types";
import {
  ariaSortFor,
  groupStatus,
  groupValue,
  type RegisterSortState,
} from "../_lib/register";

const TAGGED_BADGE = "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15";
const UNKNOWN_TEXT = "text-amber-700 dark:text-amber-500";

interface SortableHeadProps {
  column: CollateralRegisterSort;
  label: string;
  sort: RegisterSortState;
  onSortChange: (key: CollateralRegisterSort) => void;
  align?: "center" | "right";
}

function SortableHead({ column, label, sort, onSortChange, align }: SortableHeadProps) {
  const ariaSort = ariaSortFor(sort, column);
  const Icon =
    ariaSort === "none" ? ArrowUpDown : ariaSort === "ascending" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(align === "center" && "text-center", align === "right" && "text-right")}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onSortChange(column)}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
          ariaSort === "none" ? "text-muted-foreground" : "text-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function GroupValueCell({ group }: { group: CollateralRegisterGroup }) {
  const value = groupValue(group);
  if (value.kind === "unavailable") {
    return <span className={cn("font-normal", UNKNOWN_TEXT)}>{SHARE_CAPITAL_UNAVAILABLE_LABEL}</span>;
  }
  return (
    <>
      {formatCurrency(value.total)}
      {value.excluded > 0 && (
        <span
          className={cn("ml-1 font-normal", UNKNOWN_TEXT)}
          title={`${value.excluded} of this member's collaterals have no readable value and are excluded from this total.`}
        >
          +?
        </span>
      )}
    </>
  );
}

interface CollateralRowProps {
  collateral: RegisterCollateral;
  onDelete: (collateral: RegisterCollateral) => void;
}

function CollateralRow({ collateral: c, onDelete }: CollateralRowProps) {
  // No loan context on this screen, so every active holder counts.
  const lock = collateralLock(c);
  const locked = isLocked(lock);
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/30">
      <TableCell />
      <TableCell className="pl-6">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {c.collateral_type?.name ?? "Unknown"}
          </Badge>
          <span className="text-xs text-muted-foreground">{c.detail_value}</span>
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="text-right text-xs tabular-nums">
        {c.value_unknown ? (
          <span className={UNKNOWN_TEXT}>{SHARE_CAPITAL_UNAVAILABLE_LABEL}</span>
        ) : (
          formatCurrency(c.effective_value)
        )}
      </TableCell>
      <TableCell>
        {locked ? (
          <Badge
            className={
              lock.state === "unknown"
                ? "bg-muted text-muted-foreground hover:bg-muted"
                : TAGGED_BADGE
            }
            title={holdersSentence(lock) ?? undefined}
          >
            {lockLabel(lock)}
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
              render={<Link href={`/collaterals/${c.id}`} />}
              aria-label="Edit"
            >
              <PencilLine className="h-4 w-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission="collaterals:delete">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(c)}
              disabled={locked}
              title={holdersSentence(lock) ?? "Delete"}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </PermissionGate>
          {/* One link per holder. A collateral on two active loans has two
              loans worth opening, and a single arrow could only reach one. */}
          {lock.holders.map((holder) => (
            <Button
              key={holder.id}
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={`/loans/${holder.id}`} />}
              aria-label={`Go to loan ${holder.loan_account_number ?? `#${holder.id}`}`}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

export interface RegisterTableProps {
  groups: CollateralRegisterGroup[];
  sort: RegisterSortState;
  onSortChange: (key: CollateralRegisterSort) => void;
  expanded: ReadonlySet<number>;
  onToggle: (borrowerId: number) => void;
  onDelete: (collateral: RegisterCollateral) => void;
}

/**
 * One page of member groups, each expandable to its collaterals. Every figure
 * is the server's; nothing here sums, filters or sorts.
 */
export function RegisterTable({
  groups,
  sort,
  onSortChange,
  expanded,
  onToggle,
  onDelete,
}: RegisterTableProps) {
  const sortProps = { sort, onSortChange };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <SortableHead column="member" label="Member" {...sortProps} />
          <SortableHead column="collaterals" label="Collaterals" align="center" {...sortProps} />
          <SortableHead column="total_value" label="Total Value" align="right" {...sortProps} />
          <SortableHead column="tagged" label="Status" {...sortProps} />
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const isExpanded = expanded.has(group.borrower_id);
          const status = groupStatus(group);
          return (
            <Fragment key={group.borrower_id}>
              <TableRow
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => onToggle(group.borrower_id)}
              >
                <TableCell className="w-8 text-muted-foreground">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(group.borrower_id);
                    }}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Hide" : "Show"} collaterals for ${group.borrower_name}`}
                    className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{group.borrower_name}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-mono">
                    {group.collaterals_count}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <GroupValueCell group={group} />
                </TableCell>
                <TableCell>
                  {status.tagged ? (
                    <Badge className={TAGGED_BADGE}>{status.label}</Badge>
                  ) : (
                    <Badge variant="outline">{status.label}</Badge>
                  )}
                </TableCell>
                <TableCell />
              </TableRow>

              {isExpanded &&
                group.collaterals.map((c) => (
                  <CollateralRow key={c.id} collateral={c} onDelete={onDelete} />
                ))}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
