/**
 * What an import may carry, as the server rules it (`StoreCsvImportRunRequest`):
 * the members file, the share capital file (finish run round 2, decision 13),
 * or both, and the loans file only beside the members file. A loan finds its
 * member through the members file of the same import, so a loans file without
 * it is refused. Members alone are fine (a cooperative with no loans to carry
 * over, or a batch of new members), and so is share capital alone, for members
 * already in Lendyph. The share capital file is for staff who can record share
 * capital (`share_capital:create`), as the server rules, so it is offered only
 * to them.
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
  share_capital: "Share capital file",
};

/** The name inside a sentence: "the members file needs 26". */
export function fileNameInSentence(kind: ImportFileKind): string {
  return FILE_LABELS[kind].toLowerCase();
}

/**
 * Every file an import can carry, in the order the import reads them (members,
 * then loans, then share capital) and every step lists them. One list, so no
 * step can leave a file out.
 */
export const IMPORT_FILE_KINDS: readonly ImportFileKind[] = ["customers", "loans", "share_capital"];

/**
 * A run's own files, in the order the import reads them, off any map keyed by
 * kind: the status's `files`, or a saved session's.
 */
export function runFileKinds(files: Partial<Record<ImportFileKind, unknown>> | null | undefined): ImportFileKind[] {
  return IMPORT_FILE_KINDS.filter((kind) => files?.[kind] != null);
}

/**
 * How Upload, Processing, the result and a resumed check speak of every file
 * of the run at once: the one file by its name, both, or all three. A
 * members-only run is never told about "both files". Before the run's files
 * are known, the words claim no number.
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
  if (kinds.length > 2) {
    return {
      verified: "All three files are on the server and verified",
      announced: "All three files uploaded and verified.",
      sent: "of all three files sent",
      copies: "the copies on your computer are",
      everyRow: "Every row in the three files",
      stillRead: "the files are still being read",
      again: "the files",
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

/**
 * The rule, for the Prepare step: with the share capital file when the person
 * importing can record share capital, and today's rule when they can't.
 */
export function filesRule(shareCapitalAllowed: boolean): string {
  return shareCapitalAllowed
    ? "Pick the members file, the share capital file, or both. The loans file is optional, and needs its members file in the same import."
    : "The members file is required; the loans file is optional (it needs its members in the same import).";
}

export interface FileSlotSpec {
  kind: ImportFileKind;
  label: string;
  description: string;
  hint: string;
  optional: boolean;
}

/** The Prepare step's slots, in the order the import reads the files. */
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
  {
    kind: "share_capital",
    label: FILE_LABELS.share_capital,
    description: "One row per share capital contribution or withdrawal.",
    hint: "Each row names its member by account number or member ID: one in the members file of the same import, or already in Lendyph.",
    optional: true,
  },
];

/** The slots this person may fill: the share capital one only when they can record share capital. */
export function fileSlots(shareCapitalAllowed: boolean): readonly FileSlotSpec[] {
  return shareCapitalAllowed ? FILE_SLOTS : FILE_SLOTS.filter((slot) => slot.kind !== "share_capital");
}

/** Why the picked files can't be imported yet, in words, or null when they can. */
export function filesProblem(
  files: { customers: object | null; loans: object | null; share_capital?: object | null },
  shareCapitalAllowed = true,
): string | null {
  if (files.loans && !files.customers) {
    return "A loans file needs its members file in the same import. Pick the members file too.";
  }
  if (files.customers || (shareCapitalAllowed && files.share_capital)) return null;
  return shareCapitalAllowed
    ? "Pick the members file or the share capital file to continue."
    : "Pick the members file to continue.";
}
