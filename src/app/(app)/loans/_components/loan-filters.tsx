"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Search, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDateObj } from "@/lib/format";

export interface LoanFiltersProps {
  search: string;
  onSearchChange: (q: string) => void;
  productId: number | null;
  onProductChange: (id: number | null) => void;
  dateFrom: Date | null;
  dateTo: Date | null;
  onDateRangeChange: (from: Date | null, to: Date | null) => void;
  productOptions: { id: number; name: string }[];
  productsLoading: boolean;
}

const PRODUCT_ALL_VALUE = "__all__";

export function LoanFilters({
  search,
  onSearchChange,
  productId,
  onProductChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  productOptions,
  productsLoading,
}: LoanFiltersProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const hasAnyFilter =
    search.trim() !== "" ||
    productId !== null ||
    dateFrom !== null ||
    dateTo !== null;

  function handleClear() {
    onSearchChange("");
    onProductChange(null);
    onDateRangeChange(null, null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search loans..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Select
        value={productId == null ? PRODUCT_ALL_VALUE : String(productId)}
        onValueChange={(val) =>
          onProductChange(val === PRODUCT_ALL_VALUE ? null : Number(val))
        }
        disabled={productsLoading}
        items={[
          { value: PRODUCT_ALL_VALUE, label: "All products" },
          ...productOptions.map((p) => ({ value: String(p.id), label: p.name })),
        ]}
      >
        <SelectTrigger size="sm" className="w-full sm:w-48">
          <SelectValue
            placeholder={productsLoading ? "Loading…" : "All products"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PRODUCT_ALL_VALUE}>All products</SelectItem>
          {productOptions.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={dateFrom ? `From date: ${formatDateObj(dateFrom)}` : "From date"}
              className={cn(
                "flex h-9 w-full sm:w-40 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !dateFrom && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {dateFrom ? formatDateObj(dateFrom) : "From date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom ?? undefined}
            onSelect={(d) => {
              const newFrom = d ?? null;
              const nextTo =
                newFrom && dateTo && dateTo < newFrom ? null : dateTo;
              onDateRangeChange(newFrom, nextTo);
              setFromOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={dateTo ? `To date: ${formatDateObj(dateTo)}` : "To date"}
              className={cn(
                "flex h-9 w-full sm:w-40 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !dateTo && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {dateTo ? formatDateObj(dateTo) : "To date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo ?? undefined}
            disabled={(d) => (dateFrom ? d < dateFrom : false)}
            onSelect={(d) => {
              onDateRangeChange(dateFrom, d ?? null);
              setToOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {hasAnyFilter ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-muted-foreground"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
