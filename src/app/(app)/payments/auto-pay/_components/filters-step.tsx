"use client";

import { useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { loanProductService } from "@/services/loan-product.service";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";
import type { LoanProduct } from "@/types/loan";
import type { AutoPayFilter } from "@/types";

interface FiltersStepProps {
  onPreview: (filter: AutoPayFilter) => void;
  loading: boolean;
}

export function FiltersStep({ onPreview, loading }: FiltersStepProps) {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [allProducts, setAllProducts] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  useEffect(() => {
    loanProductService
      .list()
      .then((res) => setProducts(res as LoanProduct[]))
      .finally(() => setProductsLoading(false));
  }, []);

  function toggleProduct(id: number) {
    setAllProducts(false);
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function toggleAllProducts(checked: boolean) {
    setAllProducts(checked);
    if (checked) setSelectedProductIds([]);
  }

  function formatDateDisplay(date: Date | undefined) {
    if (!date) return "Select date";
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function toISODate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  function handlePreview() {
    if (!dateFrom || !dateTo) return;
    onPreview({
      product_ids: allProducts ? [] : selectedProductIds,
      date_from: toISODate(dateFrom),
      date_to: toISODate(dateTo),
    });
  }

  const canPreview =
    !!dateFrom &&
    !!dateTo &&
    (allProducts || selectedProductIds.length > 0);

  return (
    <div className="space-y-6">
      {/* Products */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Loan Products</Label>
        {productsLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Loading products…
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            <label className="flex cursor-pointer items-center gap-3 bg-muted/30 px-4 py-3">
              <Checkbox
                checked={allProducts}
                onCheckedChange={(v) => toggleAllProducts(Boolean(v))}
              />
              <span className="text-sm font-medium">All Products</span>
            </label>
            {products.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/20"
              >
                <Checkbox
                  checked={!allProducts && selectedProductIds.includes(p.id)}
                  onCheckedChange={() => toggleProduct(p.id)}
                />
                <span className="text-sm">{p.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Selecting &ldquo;All Products&rdquo; overrides individual selections.
        </p>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          Date Range{" "}
          <span className="font-normal text-muted-foreground">(inclusive)</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">From</p>
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className={dateFrom ? "" : "text-muted-foreground"}>
                  {formatDateDisplay(dateFrom)}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => {
                    if (d) {
                      setDateFrom(d);
                      setFromOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">To</p>
            <Popover open={toOpen} onOpenChange={setToOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className={dateTo ? "" : "text-muted-foreground"}>
                  {formatDateDisplay(dateTo)}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  disabled={(d) => !!dateFrom && d < dateFrom}
                  onSelect={(d) => {
                    if (d) {
                      setDateTo(d);
                      setToOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Amortization dues with a due_date within this range will be included.
        </p>
      </div>

      <Button
        className="w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        onClick={handlePreview}
        disabled={!canPreview || loading}
      >
        {loading && <Spinner className="mr-2 size-4" />}
        Preview Auto-Pay →
      </Button>
    </div>
  );
}
