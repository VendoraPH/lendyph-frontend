"use client";

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

export function TablePagination({
  page,
  perPage,
  total,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  onPageChange,
  onPerPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, total);
  const hasResults = total > 0;

  return (
    <div className="flex items-center justify-between pt-4 border-t mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(perPage)}
          onValueChange={(val) => {
            if (val != null) onPerPageChange(Number(val));
          }}
        >
          <SelectTrigger size="sm" className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {perPageOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
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
