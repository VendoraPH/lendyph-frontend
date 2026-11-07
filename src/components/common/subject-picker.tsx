"use client";

import { useEffect, useState } from "react";
import { LoanSearchPicker } from "@/components/common/loan-search-picker";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks";
import type { LoanOption } from "@/hooks/use-loan-search";
import type { MemberOption } from "@/hooks/use-member-search";

/**
 * What this picker can search.
 *
 * Reports alias it as `ReportSubject`; printables' `PrintableSubject` is this
 * plus `repayment`, which has its own picker on the printables detail page —
 * widening this union would make every caller handle a case it cannot produce.
 */
export type SubjectKind = "loan" | "borrower";

interface SubjectPickerProps {
  subject: SubjectKind;
  value: number | null;
  onChange: (id: number | null) => void;
}

const TRIGGER_CLASS = "h-9 w-64";

/**
 * Loan / member selector for the two subject-scoped reports and for every
 * loan- or member-scoped printable.
 *
 * Searches the server as you type, one page at a time: the drain this replaces
 * stopped at 2,000 records, and nobody can pick an option that is not on the
 * list. That failure read as "that member is not registered" and "that loan
 * does not exist", on the screens where you go to print somebody's paperwork.
 *
 * Loans need `loans:view` and members `borrowers:view`, neither of which the
 * report and document screens imply. Without it the picker is locked.
 */
export function SubjectPicker({ subject, value, onChange }: SubjectPickerProps) {
  const canList = usePermission().can(
    subject === "loan" ? "loans:view" : "borrowers:view",
  );
  // The row picked, which holds its name: the search moves on, the choice stays.
  const [member, setMember] = useState<MemberOption | null>(null);
  const [loan, setLoan] = useState<LoanOption | null>(null);

  useEffect(() => {
    // Clear a selection carried over from the other subject type — a loan id
    // is meaningless once the picker is showing members.
    onChange(null);
    // onChange is a stable setter from the parent; re-running on identity
    // changes would clear the user's selection on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, canList]);

  if (subject === "loan") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">Loan</Label>
        <LoanSearchPicker
          value={loan?.id === value ? loan : null}
          onChange={(next) => {
            setLoan(next);
            onChange(next?.id ?? null);
          }}
          canSearch={canList}
          placeholder="Search loan…"
          aria-label="Loan"
          className={TRIGGER_CLASS}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">Member</Label>
      <MemberSearchPicker
        value={member?.id === value ? member : null}
        onChange={(next) => {
          setMember(next);
          onChange(next?.id ?? null);
        }}
        canSearch={canList}
        placeholder="Search member…"
        aria-label="Member"
        className={TRIGGER_CLASS}
      />
    </div>
  );
}
