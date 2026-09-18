"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { cn } from "@/lib/utils";
import type { GCashParty } from "@/types";
import type {
  GCashPartyOption,
  GCashPartyShortfall,
} from "../_hooks/use-gcash-parties";

interface Props {
  id: string;
  options: GCashPartyOption[];
  value: GCashParty | null;
  onChange(party: GCashParty | null): void;
  /** Plural, lowercase: "members" / "walk-ins". Drives every string below. */
  noun: string;
  loading?: boolean;
  disabled?: boolean;
  /** Non-null when the drain behind `options` came up short. */
  shortfall?: GCashPartyShortfall | null;
}

/**
 * The searchable who-is-this-for control, shared by both sides of the counter.
 *
 * cmdk filters client-side over the items that are actually RENDERED, so the
 * completeness of `options` is the completeness of the search: an option that
 * was never passed in cannot be found by typing its name, and the control says
 * "No members found" — indistinguishable from the member not existing. That is
 * why this takes a fully drained list plus its `shortfall`, and why it renders
 * the shortfall rather than letting the caller decide to skip it.
 */
export function GCashPartyPicker({
  id,
  options,
  value,
  onChange,
  noun,
  loading = false,
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
              role="combobox"
              aria-expanded={open}
              disabled={disabled || loading}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          }
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value
              ? value.full_name
              : loading
                ? `Loading ${noun}…`
                : `Search ${singular}…`}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command>
            <CommandInput placeholder={`Type a name to search…`} />
            <CommandList>
              <CommandEmpty>No {noun} found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={`${option.party.kind}-${option.party.id}`}
                    value={option.searchText}
                    onSelect={() => {
                      onChange(
                        value?.id === option.party.id ? null : option.party,
                      );
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        value?.id === option.party.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="truncate">{option.party.full_name}</span>
                    {option.hint && (
                      <span className="ml-1 truncate text-muted-foreground">
                        ({option.hint})
                      </span>
                    )}
                  </CommandItem>
                ))}
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
          consequence={`A ${singular} missing from this list cannot be selected, so no transaction can be recorded for them here.`}
        />
      )}
    </div>
  );
}
