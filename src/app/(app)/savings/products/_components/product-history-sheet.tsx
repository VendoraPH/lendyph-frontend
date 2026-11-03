"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { DataState } from "@/components/common/data-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { savingsProductService } from "@/services/savings-product.service";
import type { SavingsProduct } from "@/types/savings";

function HistoryList({ productId }: { productId: number }) {
  const fetcher = useCallback(() => savingsProductService.history(productId), [productId]);
  const resource = useApiResource(fetcher);

  return (
    <DataState
      resource={resource}
      summary="Every change made to this product: who, when, and the old and new values."
      endpoints={[`GET /savings/products/{id}/history`]}
      isEmpty={(rows) => rows.length === 0}
      emptyMessage="No changes recorded yet."
    >
      {(rows) => (
        <ol className="space-y-3">
          {rows.map((entry) => (
            <li key={entry.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium capitalize">{entry.action.replaceAll("_", " ")}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
              </div>
              {entry.field && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.field.replaceAll("_", " ")}:{" "}
                  <span className="line-through">{entry.old_value ?? "—"}</span> →{" "}
                  <span className="font-medium text-foreground">{entry.new_value ?? "—"}</span>
                </p>
              )}
              {entry.remarks && <p className="mt-1 text-xs">{entry.remarks}</p>}
              <p className="mt-1 text-xs text-muted-foreground">By {entry.user?.name ?? "System"}</p>
            </li>
          ))}
        </ol>
      )}
    </DataState>
  );
}

export function ProductHistorySheet({
  product,
  onOpenChange,
}: {
  /** The product whose history is open; `null` closes the sheet. */
  product: SavingsProduct | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Change history</SheetTitle>
          <SheetDescription>
            {product ? `${product.code} · ${product.name}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">{product && <HistoryList productId={product.id} />}</div>
      </SheetContent>
    </Sheet>
  );
}
