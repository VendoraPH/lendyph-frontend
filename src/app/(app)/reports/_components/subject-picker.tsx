"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { borrowerService, loanService } from "@/services";
import type { ReportSubject } from "../_lib/types";

interface SubjectOption {
  id: number;
  label: string;
  hint?: string;
}

interface SubjectPickerProps {
  subject: ReportSubject;
  value: number | null;
  onChange: (id: number | null) => void;
}

/**
 * Loan / borrower selector for the two subject-scoped reports.
 *
 * Fetches one generous page and filters in the browser, matching how the new
 * loan form sources its borrower list. A server-side search would be the right
 * call at a much larger member count, but it would also add a debounce and a
 * request per keystroke for a list that is currently small enough to hold.
 */
export function SubjectPicker({ subject, value, onChange }: SubjectPickerProps) {
  const [options, setOptions] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOptions([]);
    // Clear a selection carried over from the other subject type — a loan id
    // is meaningless once the picker is showing borrowers.
    onChange(null);

    const request =
      subject === "loan"
        ? loanService
            .list({ per_page: 200, status: "released" })
            .then((res) =>
              (res?.data ?? []).map((loan) => ({
                id: loan.id,
                label:
                  loan.loan_account_number ??
                  loan.application_number ??
                  `Loan #${loan.id}`,
                hint: loan.borrower?.full_name ?? loan.borrower?.name,
              }))
            )
        : borrowerService
            .list({ per_page: 200 })
            .then((res) =>
              (res?.data ?? []).map((borrower) => ({
                id: borrower.id,
                label: borrower.full_name,
                hint: borrower.borrower_code,
              }))
            );

    request
      .then((list) => {
        if (!cancelled) setOptions(list);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            `Unable to load ${subject === "loan" ? "loans" : "borrowers"}.`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // onChange is a stable setter from the parent; re-running on identity
    // changes would clear the user's selection on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const noun = subject === "loan" ? "Loan" : "Borrower";
  const placeholder = loading
    ? `Loading ${noun.toLowerCase()}s…`
    : error
      ? error
      : `Search ${noun.toLowerCase()}…`;

  return (
    <div className="space-y-1">
      <Label className="text-xs">{noun}</Label>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(item: SubjectOption | null) =>
          onChange(item?.id ?? null)
        }
        itemToStringLabel={(item: SubjectOption) => item.label}
      >
        <ComboboxInput
          placeholder={placeholder}
          disabled={loading || !!error}
          showClear
          className="h-9 w-64"
        />
        <ComboboxContent>
          <ComboboxEmpty>No {noun.toLowerCase()} found.</ComboboxEmpty>
          <ComboboxList>
            {(item: SubjectOption) => (
              <ComboboxItem key={item.id} value={item}>
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <span className="text-xs text-muted-foreground truncate">
                      {item.hint}
                    </span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
