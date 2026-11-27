// What a restructured loan shows for what its restructure didn't carry: the
// forgiveness approved (`write_off_amount`, on the closed loan) and the
// principal written off in the books (`restructure_written_off_principal`, on
// the new loan the restructure released). Two different figures, so each is
// labelled; both are the server's, and nothing is worked out here.

import { restructureSuccessor } from "@/lib/loan-restructure";
import { currencyOrDash } from "@/lib/report-format";

export interface WriteOffFigure {
  label: string;
  /** As the server sent it; null when it sent none. */
  amount: number | null;
}

function figure(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * What the closed loan carries: its own `write_off_amount`, and the
 * restructures raised on it, of which the released one holds the books figure.
 * Loose, so the printables can pass the API's raw record.
 */
export interface RestructuredLoanWriteOff {
  write_off_amount?: unknown;
  restructured_into?: readonly { status?: unknown; restructure_written_off_principal?: unknown }[] | null;
}

export function restructureWriteOffFigures(loan: RestructuredLoanWriteOff): WriteOffFigure[] {
  const successor = restructureSuccessor(loan.restructured_into);
  return [
    { label: "Forgiven (approved)", amount: figure(loan.write_off_amount) },
    { label: "Principal written off in the books", amount: figure(successor?.restructure_written_off_principal) },
  ];
}

/** ₱ with two decimals; a dash for a figure the server didn't send. */
export function writeOffFigureText(amount: number | null): string {
  return currencyOrDash(amount);
}
