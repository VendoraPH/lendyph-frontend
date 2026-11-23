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

const KIND_ORDER: readonly ImportFileKind[] = ["customers", "loans"];

/**
 * A run's own files, in the order the import reads them, off any map keyed by
 * kind: the status's `files`, or a saved session's.
 */
export function runFileKinds(files: Partial<Record<ImportFileKind, unknown>> | null | undefined): ImportFileKind[] {
  return KIND_ORDER.filter((kind) => files?.[kind] != null);
}

/**
 * How Upload, Processing, the result and a resumed check speak of every file
 * of the run at once: the one file by its name, or both. A members-only run
 * is never told about "both files". Before the run's files are known, the
 * words claim no number.
 */
export function filesPhrase(kinds: readonly ImportFileKind[]): {
  verified: string;
  announced: string;
  sent: string;
  copies: string;
  everyRow: string;
  stillRead: string;
  again: string;
} {
  if (kinds.length === 1) {
    const name = fileNameInSentence(kinds[0]);
    return {
      verified: `The ${name} is on the server and verified`,
      announced: `The ${name} is uploaded and verified.`,
      sent: `of the ${name} sent`,
      copies: "the copy on your computer is",
      everyRow: `Every row in the ${name}`,
      stillRead: `the ${name} is still being read`,
      again: `the ${name}`,
    };
  }
  if (kinds.length > 1) {
    return {
      verified: "Both files are on the server and verified",
      announced: "Both files uploaded and verified.",
      sent: "of both files sent",
      copies: "the copies on your computer are",
      everyRow: "Every row in both files",
      stillRead: "the files are still being read",
      again: "the files",
    };
  }
  return {
    verified: "Your files are on the server and verified",
    announced: "Your files are uploaded and verified.",
    sent: "of your files sent",
    copies: "the copies on your computer are",
    everyRow: "Every row in your files",
    stillRead: "your files are still being read",
    again: "your files",
  };
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
