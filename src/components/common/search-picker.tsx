"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SearchPickerProps<T extends { id: number }> {
  id?: string;
  /** What the trigger reads for the chosen record; it never depends on the current rows. */
  valueLabel: string | null;
  selectedId: number | null;
  placeholder: string;
  searchPlaceholder: string;
  /** Locks the trigger, for a role that may not list these records. */
  disabled?: boolean;
  /** The search behind the list; see `useSearchPage`. */
  search: { query: string; setQuery: (query: string) => void; reset: () => void };
  rows: T[];
  renderRow: (row: T) => ReactNode;
  /** Typing has not settled, or its request is still out. */
  pending: boolean;
  /** The line under the list. */
  status: string;
  emptyMessage: string | null;
  /** The row was chosen. Picking the chosen record again passes it too. */
  onPick: (row: T) => void;
  /** The popup opened, so the caller's search can ask for its first page. */
  onOpen: () => void;
  "aria-label"?: string;
  className?: string;
}

/**
 * The popup behind every server-searched picker: a trigger that keeps the chosen
 * name, a search box, one page of rows and a status line. The server decides
 * what matches, so cmdk's own filter stays off.
 */
export function SearchPicker<T extends { id: number }>({
  id,
  valueLabel,
  selectedId,
  placeholder,
  searchPlaceholder,
  disabled = false,
  search,
  rows,
  renderRow,
  pending,
  status,
  emptyMessage,
  onPick,
  onOpen,
  "aria-label": ariaLabel,
  className,
}: SearchPickerProps<T>) {
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) onOpen();
    else search.reset();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn("w-full min-w-0 justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate", !valueLabel && "text-muted-foreground")}>
          {valueLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command
          shouldFilter={false}
          onKeyDown={(event) => {
            // Enter picks the highlighted row, and while a search is out that
            // row still belongs to the previous query.
            if (event.key === "Enter" && pending) event.preventDefault();
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={search.query}
            onValueChange={search.setQuery}
          />
          <CommandList>
            <CommandEmpty className={cn(!emptyMessage && "py-0")}>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {rows.map((row) => (
                <CommandItem
                  key={row.id}
                  value={String(row.id)}
                  onSelect={() => {
                    onPick(row);
                    handleOpenChange(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4 shrink-0", selectedId === row.id ? "opacity-100" : "opacity-0")}
                  />
                  {renderRow(row)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <p
            role="status"
            className={cn("text-xs text-muted-foreground", status && "border-t px-2.5 py-2")}
          >
            {status}
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
