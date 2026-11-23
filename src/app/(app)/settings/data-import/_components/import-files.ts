/**
 * What an import may carry, as the server rules it (`StoreCsvImportRunRequest`):
 * the members file always, and the loans file only beside it. A loan finds its
 * member through the members file of the same import, so a loans file on its
 * own is refused. Members alone are fine: a cooperative with no loans to carry
 * over, or a batch of new members.
 *
 * Pure, so it runs under `tsx --test`.
 */
import type { ImportFileKind } from "@/types/data-import";

/**
 * What each file is called, on every step of the import: Prepare's slots,
 * Check's cards and refusals, Upload, and the result. One map, so no step can
 * call a file something else. Also what `FileInspection.label` is, and the
 * name a resumed run reaches for when it has no inspection.
 */
export const FILE_LABELS: Record<ImportFileKind, string> = {
  customers: "Members file",
  loans: "Loans file",
};

/** The name inside a sentence: "the members file needs 26". */
export function fileNameInSentence(kind: ImportFileKind): string {
  return FILE_LABELS[kind].toLowerCase();
}

/** The rule in one sentence, for the Prepare step. */
export const FILES_RULE =
  "The members file is required; the loans file is optional (it needs its members in the same import).";

export interface FileSlotSpec {
  kind: ImportFileKind;
  label: string;
  description: string;
  hint: string;
  optional: boolean;
}

/** The Prepare step's two slots, members first as the import reads them. */
export const FILE_SLOTS: readonly FileSlotSpec[] = [
  {
    kind: "customers",
    label: FILE_LABELS.customers,
    description: "One row per member to bring in.",
    hint: "Exported as CSV from your spreadsheet: File → Save As (or Download) → CSV.",
    optional: false,
  },
  {
    kind: "loans",
    label: FILE_LABELS.loans,
    description: "One row per loan, for members in the members file.",
    hint: "Loans are matched to members by account number, so both files must use the same one.",
    optional: true,
  },
];

/** Why the picked files can't be imported yet, in words, or null when they can. */
export function filesProblem(files: { customers: object | null; loans: object | null }): string | null {
  if (files.customers) return null;
  return files.loans
    ? "A loans file needs its members file in the same import. Pick the members file too."
    : "Pick the members file to continue.";
}
