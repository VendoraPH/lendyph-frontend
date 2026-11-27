/**
 * Opening a saved draft in the line editor: the stored centavos become the
 * text the amount boxes hold, and the unused side of a line stays blank.
 */
import { emptyLine } from "@/lib/accounting/journal";
import type { JournalEntry, JournalEntryDraft, JournalLineDraft } from "@/types";

/**
 * Whole centavos as amount-box text ("15000.50"), by moving the decimal point
 * in the digits rather than dividing, so no amount drifts on the way back.
 */
export function centavosAsInput(centavos: number): string {
  const digits = String(Math.trunc(Math.abs(centavos))).padStart(3, "0");
  const sign = centavos < 0 ? "-" : "";
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function sideText(centavos: number): string {
  return centavos ? centavosAsInput(centavos) : "";
}

export function draftFromEntry(entry: JournalEntry): JournalEntryDraft {
  const lines: JournalLineDraft[] = entry.lines.map((line) => ({
    account_id: line.account_id,
    description: line.description ?? "",
    debit: sideText(line.debit),
    credit: sideText(line.credit),
  }));
  while (lines.length < 2) lines.push(emptyLine());

  return {
    date: entry.date,
    reference: entry.reference ?? "",
    branch_id: entry.branch_id,
    description: entry.description,
    lines,
  };
}
