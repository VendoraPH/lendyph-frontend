"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface TablePaginationProps {
  /** 1-based current page */
  page: number;
  perPage: number;
  /** Total rows after filtering */
  total: number;
  /** Defaults to [10, 20, 50] */
  perPageOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50] as const;

/**
 * Rows-per-page and previous/next under a table. Put it after the table's
 * `ScrollBox` inside a `FillSection` (or a `CardContent` with
 * `FIT_CLASSES.section`) and it stays pinned at the card's foot:
 *
 *     <CardContent className={FIT_CLASSES.section}>
 *       <ScrollBox><Table>…</Table></ScrollBox>
 *       <TablePagination page={page} perPage={perPage} total={total} … />
 *     </CardContent>
 */
export function TablePagination({
  page,
  perPage,
  total,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  onPageChange,
  onPerPageChange,
}: TablePaginationProps) {
  // Names the rows-per-page picker for screen readers.
  const rowsLabelId = useId();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, total);
  const hasResults = total > 0;
  // The value is the number's own text, but Base UI reads the trigger's text
  // from `items`, so the dropdown is given them like every other one.
  const perPageItems = perPageOptions.map((opt) => ({ value: String(opt), label: String(opt) }));

  // `shrink-0`: in a FillSection the ScrollBox above takes the height and this
  // stays pinned at the card's foot. `data-fab-clear` keeps its right end clear
  // of the floating Linda button at fit (globals.css).
  return (
    <div
      data-slot="table-pagination"
      data-fab-clear=""
      className="flex shrink-0 items-center justify-between pt-4 border-t mt-4"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span id={rowsLabelId}>Rows per page</span>
        <Select
          items={perPageItems}
          value={String(perPage)}
          onValueChange={(val) => {
            if (val != null) onPerPageChange(Number(val));
          }}
        >
          <SelectTrigger size="sm" className="w-16" aria-labelledby={rowsLabelId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {perPageItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground tabular-nums">
          {hasResults
            ? `Showing ${startIndex + 1} to ${endIndex} of ${total} results`
            : "No results"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={!hasResults || safePage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={!hasResults || safePage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
