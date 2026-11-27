"use client";

import { useState } from "react";
import { SearchPicker } from "@/components/common/search-picker";
import { useLoanSearch, type LoanOption } from "@/hooks/use-loan-search";

interface LoanSearchPickerProps {
  /** The chosen loan, number included, so it shows whatever the search has moved on to. */
  value: LoanOption | null;
  /** Null when the chosen loan is picked again, which clears it. */
  onChange: (loan: LoanOption | null) => void;
  /** Whether this role may list loans (`loans:view`). Without it the picker is locked. */
  canSearch: boolean;
  placeholder: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * A loan picker searched on the server as you type: by account or application
 * number, or the member's name or code. The list loads when the popup first opens.
 */
export function LoanSearchPicker({
  value,
  onChange,
  canSearch,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: LoanSearchPickerProps) {
  const [everOpened, setEverOpened] = useState(false);
  const search = useLoanSearch({ enabled: canSearch && everOpened });

  return (
    <SearchPicker
      valueLabel={value?.label ?? null}
      selectedId={value?.id ?? null}
      placeholder={placeholder}
      searchPlaceholder="Search loan number or member..."
      disabled={!canSearch}
      search={search}
      rows={search.rows}
      renderRow={(loan) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{loan.label}</span>
          {loan.hint && <span className="truncate text-xs text-muted-foreground">{loan.hint}</span>}
        </div>
      )}
      pending={search.pending}
      status={search.status}
      emptyMessage={search.emptyMessage}
      onPick={(loan) => onChange(loan.id === value?.id ? null : loan)}
      onOpen={() => setEverOpened(true)}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
