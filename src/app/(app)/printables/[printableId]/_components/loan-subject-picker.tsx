"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
// Deep import, not the barrel: re-exporting either of these costs every page
// that imports `@/components/common` ~52 kB it cannot use.
import { SubjectPicker } from "@/components/common/subject-picker";
import { isActiveLoanStatus } from "@/constants";
import { formatCurrency } from "@/lib/format";
import { loanService } from "@/services";
import type { Loan } from "@/types";
import { Loader2 } from "lucide-react";
import { BorrowerLoansTable, loanNumber } from "./borrower-loans-table";

/**
 * Pick the member first, then the loan.
 *
 * The flat loan combobox this replaces listed account numbers — the one thing
 * about a loan nobody at a counter knows by heart. Staff are handed a name, so
 * the name is the way in, and the loans that name holds are laid out with the
 * figures needed to tell them apart: amount, release date, balance, status.
 *
 * Lives beside the printables route rather than in `components/common`: its
 * sibling `SubjectPicker` is shared with Reports, which has no screen that
 * wants a table here.
 */

type LoanFilter = "active" | "inactive" | "all";

const FILTER_LABELS: Record<LoanFilter, string> = {
  active: "Active",
  inactive: "Closed",
  all: "All",
};

interface LoanSubjectPickerProps {
  /** Lifted so the page can drop its empty state once a member is chosen. */
  borrowerId: number | null;
  onBorrowerChange: (id: number | null) => void;
  /** The chosen loan — this is what the document is built from. */
  value: number | null;
  onChange: (id: number | null) => void;
}

export function LoanSubjectPicker({
  borrowerId,
  onBorrowerChange,
  value,
  onChange,
}: LoanSubjectPickerProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when the drain gave up with pages outstanding, so this member's
  // list is knowingly short. Null means complete.
  const [shortfall, setShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);
  const [filter, setFilter] = useState<LoanFilter>("active");

  useEffect(() => {
    // A loan id belongs to the member it was picked under; carrying it across
    // would print one member's paperwork under another's name.
    onChange(null);
    setShortfall(null);
    setError(null);

    if (!borrowerId) {
      setLoans([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loanService
      .listAll({ borrower_id: borrowerId })
      .then(({ rows, truncated, total }) => {
        if (cancelled) return;
        setLoans(rows);
        setShortfall(truncated ? { shown: rows.length, total } : null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load this member's loans.");
        setLoans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // onChange is a stable setter from the page; re-running on identity changes
    // would clear the user's selection on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  const counts = useMemo(() => {
    const active = loans.filter((loan) => isActiveLoanStatus(loan.status)).length;
    return { active, inactive: loans.length - active, all: loans.length };
  }, [loans]);

  const visible = useMemo(() => {
    if (filter === "all") return loans;
    const wantActive = filter === "active";
    return loans.filter((loan) => isActiveLoanStatus(loan.status) === wantActive);
  }, [loans, filter]);

  const selected = useMemo(
    () => loans.find((loan) => loan.id === value) ?? null,
    [loans, value]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <SubjectPicker
          subject="borrower"
          value={borrowerId}
          onChange={onBorrowerChange}
        />
        {!borrowerId && (
          <p className="pb-2 text-xs text-muted-foreground">
            Select the member who took the loan, then pick the loan below.
          </p>
        )}
      </div>

      {borrowerId && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={filter}
              onValueChange={(next) => setFilter(next as LoanFilter)}
            >
              <TabsList>
                {(["active", "inactive", "all"] as const).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {FILTER_LABELS[key]} ({counts[key]})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {selected && (
              <p className="text-xs text-muted-foreground">
                Printing for{" "}
                <span className="font-medium text-foreground">
                  {loanNumber(selected)}
                </span>{" "}
                · {formatCurrency(selected.principal_amount)}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading loans…
            </div>
          ) : error ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-destructive">
              {error}
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              {loans.length === 0
                ? "This member has no loans on file."
                : `No ${FILTER_LABELS[filter].toLowerCase()} loans for this member.`}
            </p>
          ) : (
            <BorrowerLoansTable
              loans={visible}
              selectedId={value}
              onSelect={onChange}
            />
          )}

          {shortfall && (
            <IncompleteListNotice
              shown={shortfall.shown}
              total={shortfall.total}
              noun="loans"
              consequence="A loan missing from this table cannot be selected, so its document cannot be printed from here."
            />
          )}
        </div>
      )}
    </div>
  );
}
