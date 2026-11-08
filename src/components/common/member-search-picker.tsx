"use client";

import { useState } from "react";
import { SearchPicker } from "@/components/common/search-picker";
import {
  selectableMembers,
  useMemberSearch,
  type MemberOption,
} from "@/hooks/use-member-search";

interface MemberSearchPickerProps {
  id?: string;
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
 * A member (or co-maker) picker searched on the server as you type. The list
 * loads when the popup first opens.
 */
export function MemberSearchPicker({
  id,
  value,
  onChange,
  canSearch,
  placeholder,
  exclude = [],
  showCode = false,
  "aria-label": ariaLabel,
  className,
}: MemberSearchPickerProps) {
  const [everOpened, setEverOpened] = useState(false);
  const search = useMemberSearch({ enabled: canSearch && everOpened });
  const rows = selectableMembers(search.rows, exclude);
  const emptyMessage =
    search.emptyMessage ??
    // Every row on this page was excluded, not "nobody matched".
    (!search.pending && search.rows.length > 0 && rows.length === 0 ? "No other member on this page." : null);

  return (
    <SearchPicker
      id={id}
      valueLabel={value ? memberLabel(value, showCode) : null}
      selectedId={value?.id ?? null}
      placeholder={placeholder}
      searchPlaceholder="Search member name or code..."
      disabled={!canSearch}
      search={search}
      rows={rows}
      renderRow={(member) => (
        <>
          <span className="truncate">{member.full_name}</span>
          {member.borrower_code && (
            <span className="ml-1 text-xs text-muted-foreground">({member.borrower_code})</span>
          )}
        </>
      )}
      pending={search.pending}
      status={search.status}
      emptyMessage={emptyMessage}
      onPick={(member) => onChange(member.id === value?.id ? null : member)}
      onOpen={() => setEverOpened(true)}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
