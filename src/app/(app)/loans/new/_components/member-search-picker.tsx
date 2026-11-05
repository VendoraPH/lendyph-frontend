"use client";

import { useState } from "react";
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
import {
  selectableMembers,
  useMemberSearch,
  type MemberOption,
} from "@/hooks/use-member-search";

interface MemberSearchPickerProps {
  /** The chosen member, name included, so it shows whatever the search has moved on to. */
  value: MemberOption | null;
  /** Null when the chosen member is picked again, which clears it. */
  onChange: (member: MemberOption | null) => void;
  /** Whether this role may list members (`borrowers:view`). Without it the picker is locked. */
  canSearch: boolean;
  placeholder: string;
  /** Members this picker must not offer: the loan's member, other slots' co-makers. */
  exclude?: readonly (number | null)[];
  /** Adds the member code to the trigger's name. */
  showCode?: boolean;
  "aria-label"?: string;
  className?: string;
}

function memberLabel(member: MemberOption, showCode: boolean): string {
  return showCode && member.borrower_code
    ? `${member.full_name} (${member.borrower_code})`
    : member.full_name;
}

/**
 * A member (or co-maker) picker searched on the server as you type. New Loan
 * and Restructure use it. The list loads when the popup first opens, and the
 * server decides what matches, so cmdk's own filter stays off.
 */
export function MemberSearchPicker({
  value,
  onChange,
  canSearch,
  placeholder,
  exclude = [],
  showCode = false,
  "aria-label": ariaLabel,
  className,
}: MemberSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const search = useMemberSearch({ enabled: canSearch && everOpened });
  const rows = selectableMembers(search.rows, exclude);
  const emptyMessage =
    search.emptyMessage ??
    // Every row on this page was excluded, not "nobody matched".
    (!search.pending && search.rows.length > 0 && rows.length === 0 ? "No other member on this page." : null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setEverOpened(true);
    else search.reset();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-label={ariaLabel}
            disabled={!canSearch}
            className={cn("w-full min-w-0 justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? memberLabel(value, showCode) : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command
          shouldFilter={false}
          onKeyDown={(event) => {
            // Enter picks the highlighted row, and while a search is out that
            // row still belongs to the previous query.
            if (event.key === "Enter" && search.pending) event.preventDefault();
          }}
        >
          <CommandInput
            placeholder="Search member name or code..."
            value={search.query}
            onValueChange={search.setQuery}
          />
          <CommandList>
            <CommandEmpty className={cn(!emptyMessage && "py-0")}>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {rows.map((member) => (
                <CommandItem
                  key={member.id}
                  value={String(member.id)}
                  onSelect={() => {
                    onChange(member.id === value?.id ? null : member);
                    handleOpenChange(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", value?.id === member.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{member.full_name}</span>
                  {member.borrower_code && (
                    <span className="ml-1 text-xs text-muted-foreground">({member.borrower_code})</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <p
            role="status"
            className={cn("text-xs text-muted-foreground", search.status && "border-t px-2.5 py-2")}
          >
            {search.status}
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
