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
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import type { Borrower, Loan } from "@/types";

/**
 * What this picker can search.
 *
 * Reports alias it as `ReportSubject`; printables' `PrintableSubject` is this
 * plus `repayment`, which has its own picker on the printables detail page —
 * widening this union would make every caller handle a case it cannot produce.
 */
export type SubjectKind = "loan" | "borrower";

interface SubjectOption {
  id: number;
  label: string;
  hint?: string;
}

interface SubjectPickerProps {
  subject: SubjectKind;
  value: number | null;
  onChange: (id: number | null) => void;
}

/**
 * Loan / borrower selector for the two subject-scoped reports and for every
 * loan- or member-scoped printable.
 *
 * Drains every page and filters in the browser, matching how the new loan form
 * sources its borrower list. A server-side search would be the right call at a
 * much larger member count, but it would also add a debounce and a request per
 * keystroke for a list that is currently small enough to hold.
 *
 * It used to ask for `per_page: 200`, twice, which both controllers clamp to
 * 100 without a word. Nobody can pick an option that is not on the list, so
 * that failure never presented as a bug: it presented as "that member is not
 * registered" and "that loan does not exist", on the screens where you go to
 * print somebody's paperwork.
 */
export function SubjectPicker({ subject, value, onChange }: SubjectPickerProps) {
  const [options, setOptions] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Set only when the drain gave up with pages outstanding, so this picker is
  // knowingly missing rows. Null means complete.
  const [shortfall, setShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOptions([]);
    // Clear a selection carried over from the other subject type — a loan id
    // is meaningless once the picker is showing borrowers.
    onChange(null);

    const request: Promise<{
      options: SubjectOption[];
      truncated: boolean;
      shown: number;
      total: number | null;
    }> =
      subject === "loan"
        ? loanService
            .listAll({ status: "released" })
            .then(({ rows, truncated, total }) => ({
              options: rows.map((loan: Loan) => ({
                id: loan.id,
                label:
                  loan.loan_account_number ??
                  loan.application_number ??
                  `Loan #${loan.id}`,
                hint: loan.borrower?.full_name ?? loan.borrower?.name,
              })),
              truncated,
              shown: rows.length,
              total,
            }))
        : borrowerService
            .listAll()
            .then(({ rows, truncated, total }) => ({
              options: rows.map((borrower: Borrower) => ({
                id: borrower.id,
                label: borrower.full_name,
                hint: borrower.borrower_code,
              })),
              truncated,
              shown: rows.length,
              total,
            }));

    request
      .then(({ options, truncated, shown, total }) => {
        if (cancelled) return;
        setOptions(options);
        setShortfall(truncated ? { shown, total } : null);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            `Unable to load ${subject === "loan" ? "loans" : "borrowers"}.`
          );
          setShortfall(null);
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
      {shortfall && (
        <IncompleteListNotice
          shown={shortfall.shown}
          total={shortfall.total}
          noun={subject === "loan" ? "loans" : "members"}
          consequence={`A ${noun.toLowerCase()} missing from this list cannot be selected, so nothing can be produced for them here.`}
          className="mt-2"
        />
      )}
    </div>
  );
}
