"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { cn } from "@/lib/utils";
import {
  isSameParty,
  partyKindLabel,
  partyOptionValue,
  type GCashPartyOption,
  type GCashPartyShortfall,
} from "../_lib/party-options";

interface Props {
  id: string;
  options: GCashPartyOption[];
  value: GCashPartyOption | null;
  onChange(option: GCashPartyOption | null): void;
  /** What the teller has typed. The caller debounces it into a server search. */
  query: string;
  onQueryChange(query: string): void;
  /** Plural, lowercase, e.g. "names". Drives every string below. */
  noun: string;
  /** Nothing has loaded yet. */
  loading?: boolean;
  /** `options` answer an earlier query; the current one is still on its way. */
  searching?: boolean;
  /** Why the current search failed, shown in place of "No … found". */
  error?: string | null;
  disabled?: boolean;
  /** Non-null when the drain behind `options` came up short. */
  shortfall?: GCashPartyShortfall | null;
}

/**
 * The searchable who-is-this-for control for both sides of the counter.
 *
 * The server does the searching (`shouldFilter={false}`): cmdk only ever saw
 * the rows already loaded, so it could not find a walk-in on a page not yet
 * fetched, nor match `12345678` to `1234-5678` the way the server does. Each
 * row's value is kind + id, so no two rows share one.
 *
 * "No … found" is only said when the search has answered and did not fail —
 * a failed or pending search must not read as "this person is not registered".
 */
export function GCashPartyPicker({
  id,
  options,
  value,
  onChange,
  query,
  onQueryChange,
  noun,
  loading = false,
  searching = false,
  error = null,
  disabled = false,
  shortfall = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const singular = noun.replace(/s$/, "");

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- Base UI PopoverTrigger sets aria-expanded and aria-controls on this button at runtime
              role="combobox"
              aria-expanded={open}
              disabled={disabled || loading}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          }
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value
              ? value.party.full_name
              : loading
                ? `Loading ${noun}…`
                : `Search ${singular}…`}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {value && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {partyKindLabel(value.party)}
              </Badge>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={onQueryChange}
              placeholder="Search by name, mobile or ID number…"
              aria-label={`Search ${noun} by name, mobile or ID number`}
            />
            <CommandList aria-busy={searching}>
              {searching && (
                <div
                  role="status"
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Searching…
                </div>
              )}
              {error ? (
                // Not role="alert": the caller announces the same error under
                // the field, where it stays visible once the list closes.
                <p className="px-2 py-6 text-center text-sm text-destructive">
                  {error}
                </p>
              ) : (
                !searching && <CommandEmpty>No {noun} found.</CommandEmpty>
              )}
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = isSameParty(value?.party, option.party);
                  const optionValue = partyOptionValue(option);
                  return (
                    <CommandItem
                      key={optionValue}
                      value={optionValue}
                      onSelect={() => {
                        onChange(isSelected ? null : option);
                        setOpen(false);
                      }}
                      className="items-start"
                    >
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="break-words">
                          {option.party.full_name}
                        </span>
                        {option.hint && (
                          <span className="break-words text-xs text-muted-foreground">
                            {option.hint}
                          </span>
                        )}
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] font-normal"
                      >
                        {partyKindLabel(option.party)}
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {shortfall && (
        <IncompleteListNotice
          shown={shortfall.shown}
          total={shortfall.total}
          noun={noun}
          consequence={`A ${singular} missing from this list cannot be selected until a search finds them: type more of their name, mobile or ID number.`}
        />
      )}
    </div>
  );
}
