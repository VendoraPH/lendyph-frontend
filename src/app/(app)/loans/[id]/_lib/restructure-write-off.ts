// What a restructured loan shows for what its restructure didn't carry: the
// forgiveness approved (`write_off_amount`, on the closed loan) and the
// principal written off in the books (`restructure_written_off_principal`, on
// the new loan the restructure released). Two different figures, so each is
// labelled; both are the server's, and nothing is worked out here.

import { restructureSuccessor } from "@/lib/loan-restructure";
import { currencyOrDash } from "@/lib/report-format";
import type { Loan } from "@/types/loan";

export interface WriteOffFigure {
  label: string;
  /** As the server sent it; null when it sent none. */
  amount: number | null;
}

function figure(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function restructureWriteOffFigures(
  loan: Pick<Loan, "write_off_amount" | "restructured_into">,
): WriteOffFigure[] {
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
