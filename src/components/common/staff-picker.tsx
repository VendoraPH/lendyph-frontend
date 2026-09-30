"use client";

import { useId, useRef, useState } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { useStaffSearch } from "@/hooks/use-staff-search";
import { STAFF_SEARCH_MAX_LENGTH } from "@/lib/staff-search";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/types";

interface StaffPickerProps {
  /**
   * The chosen officer, name included, so it shows even when it is not on the
   * page of results in hand. A loan already carries it as `account_officer`.
   */
  value: StaffMember | null;
  onChange: (value: StaffMember | null) => void;
  /** Pairs the trigger with a `<Label htmlFor>`. */
  id?: string;
  /** The accessible name where there is no visible label. */
  "aria-label"?: string;
  /** Adds a button back to "no officer", for forms where the field is optional. */
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Account Officer picker over `GET /staff`, searched on the server as you type.
 *
 * It replaced three pickers that drained `GET /users`, which only admin and
 * super_admin may read, so a loan officer got an empty list. A staff list
 * grows, so this never loads all of it: 20 rows at a time, narrowed by
 * `search`, and it says when there are more than it shows.
 *
 * Import it by path — `@/components/common` is not tree-shaken.
 */
export function StaffPicker({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  clearable = false,
  disabled = false,
  placeholder = "Select account officer",
  className,
}: StaffPickerProps) {
  const search = useStaffSearch();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const noteId = useId();
  const locked = disabled || search.forbidden;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1">
        <Combobox
          items={search.rows}
          // The server already filtered. The list shows exactly what it matched.
          filter={null}
          value={value}
          onValueChange={(next: StaffMember | null) => onChange(next)}
          itemToStringLabel={(staff: StaffMember) => staff.full_name}
          isItemEqualToValue={(a: StaffMember, b: StaffMember) => a.id === b.id}
          inputValue={search.query}
          onInputValueChange={(next, details) => {
            if (details.reason === "input-clear") search.reset();
            else search.setQuery(next);
          }}
          open={open && !locked}
          onOpenChange={setOpen}
          autoHighlight
          disabled={locked}
        >
          <ComboboxTrigger
            ref={triggerRef}
            id={id}
            aria-label={ariaLabel}
            aria-describedby={search.forbidden ? noteId : undefined}
            render={
              <Button variant="outline" className="min-w-0 flex-1 justify-between font-normal" />
            }
            onKeyDown={(event) => {
              // A letter on the closed trigger opens the search with it typed.
              // Base UI's default is select-style typeahead, which commits the
              // first loaded name with that initial, and on the loan page a
              // commit is a save. Keys that land before focus reaches the
              // search box are appended, not lost.
              if (event.key.length !== 1 || event.key === " ") return;
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              event.preventBaseUIHandler();
              event.preventDefault();
              search.setQuery(open ? search.query + event.key : event.key);
              setOpen(true);
            }}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value?.full_name ?? placeholder}
            </span>
          </ComboboxTrigger>
          <ComboboxContent aria-label="Search staff">
            <ComboboxInput
              showTrigger={false}
              placeholder="Search by name…"
              maxLength={STAFF_SEARCH_MAX_LENGTH}
              onKeyDown={(event) => {
                // Enter picks the highlighted row, and while a search is out
                // that row still belongs to the previous query.
                if (event.key === "Enter" && search.pending) {
                  event.preventBaseUIHandler();
                  event.preventDefault();
                }
              }}
            />
            <ComboboxEmpty className={cn(!search.emptyMessage && "py-0")}>
              {search.emptyMessage}
            </ComboboxEmpty>
            <ComboboxList>
              {(staff: StaffMember) => (
                <ComboboxItem key={staff.id} value={staff}>
                  <span className="truncate">{staff.full_name}</span>
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxPrimitive.Status
              className={cn(
                "text-xs text-muted-foreground",
                search.status && "border-t px-2.5 py-2",
              )}
            >
              {search.status}
            </ComboboxPrimitive.Status>
          </ComboboxContent>
        </Combobox>
        {clearable && value && !locked && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear account officer"
            onClick={() => {
              onChange(null);
              triggerRef.current?.focus();
            }}
          >
            <X />
          </Button>
        )}
      </div>
      {search.forbidden && (
        <p id={noteId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Choosing an account officer needs permission to create or edit loans,
          which your role does not have.
        </p>
      )}
    </div>
  );
}
