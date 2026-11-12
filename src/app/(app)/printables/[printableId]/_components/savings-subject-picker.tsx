"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { SearchPicker } from "@/components/common/search-picker";
import { searchEmptyMessage, searchStatus, useSearchPage } from "@/hooks/use-search-page";
import { SUBJECT_META } from "@/lib/printables/types";
import {
  fetchSavingsSubjectPage,
  type SavingsSubject,
  type SavingsSubjectOption,
} from "../_lib/savings-subject-search";

const WORDS: Record<SavingsSubject, { plural: string; singular: string; firstHint: string }> = {
  savings_account: { plural: "accounts", singular: "account", firstHint: "an account number or name" },
  savings_withdrawal: { plural: "withdrawals", singular: "withdrawal", firstHint: "a reference or name" },
  time_deposit: { plural: "time deposits", singular: "time deposit", firstHint: "a certificate number or name" },
};

/** One module-level fetcher per subject: `useSearchPage` needs a stable one. */
const FETCHERS: Record<SavingsSubject, (query: string) => ReturnType<typeof fetchSavingsSubjectPage>> = {
  savings_account: (query) => fetchSavingsSubjectPage("savings_account", query),
  savings_withdrawal: (query) => fetchSavingsSubjectPage("savings_withdrawal", query),
  time_deposit: (query) => fetchSavingsSubjectPage("time_deposit", query),
};

/**
 * A savings account, withdrawal or time deposit, searched on the server as
 * you type, 25 rows at a time. The chosen row stays shown whatever the search
 * has moved on to. The documents that use it need `savings:view`, which also
 * reads these lists.
 */
export function SavingsSubjectPicker({
  subject,
  value,
  onChange,
}: {
  subject: SavingsSubject;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [everOpened, setEverOpened] = useState(false);
  const [chosen, setChosen] = useState<SavingsSubjectOption | null>(null);
  const { query, setQuery, reset, rows, view } = useSearchPage({
    enabled: everOpened,
    fetchPage: FETCHERS[subject],
  });
  const selected = chosen?.id === value ? chosen : null;
  const meta = SUBJECT_META[subject];
  const words = WORDS[subject];

  return (
    <div className="space-y-1">
      <Label className="text-xs">{meta.label}</Label>
      <SearchPicker
        valueLabel={selected?.label ?? null}
        selectedId={selected?.id ?? null}
        placeholder={meta.placeholder}
        searchPlaceholder={meta.placeholder}
        search={{ query, setQuery, reset }}
        rows={rows}
        renderRow={(item) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{item.label}</span>
            {item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
          </div>
        )}
        pending={view.pending}
        status={searchStatus(view, { plural: words.plural, firstHint: words.firstHint })}
        emptyMessage={searchEmptyMessage(view, words.singular)}
        onPick={(item) => {
          const next = item.id === selected?.id ? null : item;
          setChosen(next);
          onChange(next?.id ?? null);
        }}
        onOpen={() => setEverOpened(true)}
        aria-label={meta.label}
        className="h-9 w-72"
      />
    </div>
  );
}
