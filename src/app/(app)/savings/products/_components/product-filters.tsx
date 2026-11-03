"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProductStatusFilter = "all" | "active" | "inactive";

interface ProductFiltersProps {
  status: ProductStatusFilter;
  onStatusChange: (status: ProductStatusFilter) => void;
  onSearch: (term: string) => void;
  /** `meta.stats` from the server: global counts, unaffected by the filters. */
  stats?: Record<string, number>;
}

const count = (stats: Record<string, number> | undefined, key: string) =>
  stats && key in stats ? ` (${stats[key]})` : "";

/** Status tabs and a search box. Search runs on Enter, not per keystroke. */
export function ProductFilters({ status, onStatusChange, onSearch, stats }: ProductFiltersProps) {
  const [term, setTerm] = useState("");
  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={status} onValueChange={(v) => onStatusChange(v as ProductStatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">All{total === undefined ? "" : ` (${total})`}</TabsTrigger>
          <TabsTrigger value="active">Active{count(stats, "active")}</TabsTrigger>
          <TabsTrigger value="inactive">Inactive{count(stats, "inactive")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <form
        role="search"
        className="relative w-full sm:w-72"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(term.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search savings products"
          placeholder="Search code or name, press Enter"
          className="pl-8"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            // Clearing the box shows everything again without needing Enter.
            if (e.target.value === "") onSearch("");
          }}
        />
      </form>
    </div>
  );
}
