import { VALID_ID_OPTIONS } from "@/constants";
import type { CoMakerValidId } from "@/services/co-maker.service";
import { ID_MIME_TYPES, validateUploadFile } from "./file-validation";

/**
 * The valid ID the co-maker dialog is about to upload.
 *
 * Kept apart from the co-maker's own fields because it travels apart: it goes
 * to `POST /co-makers/{id}/valid-ids` as multipart and is stored the way a
 * borrower's ID is — a `valid_id` document on the private disk. It can only be
 * sent once the co-maker exists, and it can fail on its own.
 */
export interface CoMakerIdDraft {
  /** A `VALID_ID_OPTIONS` value, or "" when none is chosen. */
  type: string;
  /** What the ID is, when `type` is "others" — the API requires it then. */
  custom_type_name: string;
  id_number: string;
  /** Sent as `front_file`. */
  file: File | null;
}

/** A draft that passed `checkCoMakerId` — the only kind that can be sent. */
export interface ReadyCoMakerId extends CoMakerIdDraft {
  file: File;
}

export function emptyCoMakerIdDraft(): CoMakerIdDraft {
  return { type: "", custom_type_name: "", id_number: "", file: null };
}

/** `uploadValidId` takes files of up to 10240 KB. */
export const VALID_ID_MAX_BYTES = 10 * 1024 * 1024;

/** `id_number` and `custom_type_name` are both `max:100`. */
export const VALID_ID_TEXT_MAX_LENGTH = 100;

/**
 * Steers the file picker to what the API accepts (`mimes:jpg,jpeg,png,pdf`).
 * Only a hint to the browser — `idFileProblem` is what actually checks.
 */
export const VALID_ID_FILE_ACCEPT =
  ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

export type CoMakerIdField = keyof CoMakerIdDraft;
export type CoMakerIdErrors = Partial<Record<CoMakerIdField, string>>;

export type CoMakerIdCheck =
  /** Nothing entered: there is no ID to upload, and nothing to complain about. */
  | { status: "none" }
  | { status: "invalid"; errors: CoMakerIdErrors }
  | { status: "ready"; id: ReadyCoMakerId };

/** An ID already on file, by the two fields the API groups them on. */
type IdOnFile = Pick<CoMakerValidId, "type" | "id_number">;

export function isBlankCoMakerId(draft: CoMakerIdDraft): boolean {
  return (
    !draft.type &&
    !draft.custom_type_name.trim() &&
    !draft.id_number.trim() &&
    !draft.file
  );
}

/**
 * Why this file cannot be uploaded as an ID, or `null` when it can. Checked
 * when the file is picked, so a HEIC photo or a 20 MB scan is turned away
 * before anything is saved rather than failing after the co-maker exists.
 */
export function idFileProblem(file: File): string | null {
  const result = validateUploadFile(file, ID_MIME_TYPES, VALID_ID_MAX_BYTES);
  return result.ok ? null : (result.error ?? "This file can't be used as an ID.");
}

/**
 * Whether the draft can be uploaded, and if not, what to tell the person.
 *
 * Each rule is one the API enforces, checked here so nothing is dropped in
 * silence: every upload needs a type and a file, so an ID type or number with
 * no photo cannot be stored at all, and neither can a photo with no type. The
 * ID number stays optional — unlike the member forms, which require it, the
 * API's rule for it is `nullable`.
 *
 * `onFile` is what the co-maker already has. The API lists IDs grouped by type
 * and number and deletes them by that same group, so a second upload of an ID
 * already on file would merge into the old entry — its photo hidden behind the
 * old one — and removing either would remove both. That is refused here, with
 * the way out. Numbers compare without case because the delete's lookup does
 * (MySQL, `utf8mb4_unicode_ci`), even though the listing does not.
 *
 * `required` is for when an ID is the only thing left to save, so a blank
 * draft is a mistake rather than a choice. `canRemove` says whether this
 * person may remove IDs (`borrowers:delete`) — if not, the way out named for a
 * duplicate cannot be "remove it first".
 */
export function checkCoMakerId(
  draft: CoMakerIdDraft,
  onFile: readonly IdOnFile[] = [],
  { required = false, canRemove = true }: { required?: boolean; canRemove?: boolean } = {}
): CoMakerIdCheck {
  if (!required && isBlankCoMakerId(draft)) return { status: "none" };

  const errors: CoMakerIdErrors = {};

  if (!draft.type) {
    errors.type = "Choose the ID type.";
  } else if (draft.type === "others" && !draft.custom_type_name.trim()) {
    errors.custom_type_name = "Name the ID type.";
  }

  if (!draft.file) {
    errors.file = "Add a photo of the ID. Its type and number can't be saved without one.";
  } else {
    const problem = idFileProblem(draft.file);
    if (problem) errors.file = problem;
  }

  if (draft.type && onFile.some((entry) => sameIdOnFile(entry, draft))) {
    errors.id_number = canRemove
      ? "This ID is already on file. Remove it first to replace its photo."
      : "This ID is already on file. Replacing its photo means removing it first, which your role can't do.";
  }

  if (!draft.file || Object.keys(errors).length > 0) {
    return { status: "invalid", errors };
  }
  return { status: "ready", id: { ...draft, file: draft.file } };
}

function sameIdOnFile(entry: IdOnFile, draft: CoMakerIdDraft): boolean {
  return (
    entry.type === draft.type &&
    (entry.id_number ?? "").trim().toLowerCase() === draft.id_number.trim().toLowerCase()
  );
}

/**
 * The multipart body for `POST /co-makers/{id}/valid-ids`, in the borrower
 * endpoint's shape. The photo goes as `front_file`, never the legacy `file`:
 * the API refuses a request carrying both. Optional fields that are blank are
 * left out rather than sent empty, and `custom_type_name` only rides along
 * with "others", the one type that uses it.
 */
export function coMakerIdFormData(id: ReadyCoMakerId): FormData {
  const body = new FormData();
  body.append("type", id.type);
  if (id.type === "others") body.append("custom_type_name", id.custom_type_name.trim());
  const idNumber = id.id_number.trim();
  if (idNumber) body.append("id_number", idNumber);
  body.append("front_file", id.file);
  return body;
}

/** How an ID type reads to a person: its option label, or the name typed for "others". */
export function validIdTypeLabel(type: string, customTypeName?: string | null): string {
  if (type === "others") return customTypeName?.trim() || "Others";
  return VALID_ID_OPTIONS.find((option) => option.value === type)?.label ?? type;
}
