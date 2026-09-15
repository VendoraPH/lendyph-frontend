// Shared completeness rules for the valid-ID rows captured on the public
// membership application and the admin "New Member" form.
//
// Both screens used to ask only "is there at least one usable ID?" and then
// filter the upload list down to rows that happened to have a type. A row with
// front/back photos but no ID Type selected passed that check whenever another
// row was complete, and was then dropped at submit without a word — the
// applicant was told the registration succeeded while their ID went nowhere.
// Every non-blank row is validated here instead, so an incomplete ID is
// reported to the person who can fix it rather than silently discarded.

export interface ValidIdDraft {
  type: string;
  custom_type_name: string;
  id_number: string;
  front_file: File | null;
  back_file: File | null;
  // Set once the row has been uploaded to the server, so a resubmit after a
  // partial failure neither re-uploads nor re-validates it.
  uploaded?: boolean;
}

export type ValidIdField =
  | "type"
  | "custom_type_name"
  | "id_number"
  | "front_file";

export interface ValidIdError {
  /** Index of the offending row in the array that was passed in. */
  index: number;
  field: ValidIdField;
  message: string;
}

export interface ValidIdValidation {
  ok: boolean;
  errors: ValidIdError[];
}

/**
 * True when the row holds nothing at all — an empty slot the person added and
 * never filled. Blank rows are ignored rather than flagged, so "Add ID"
 * followed by a change of mind isn't treated as an error.
 */
export function isBlankValidId(entry: ValidIdDraft): boolean {
  return (
    !entry.uploaded &&
    !entry.type &&
    !entry.custom_type_name.trim() &&
    !entry.id_number.trim() &&
    !entry.front_file &&
    !entry.back_file
  );
}

/** A row that is complete enough to upload. */
export function isCompleteValidId(entry: ValidIdDraft): boolean {
  if (entry.uploaded) return true;
  if (!entry.type || !entry.id_number.trim() || !entry.front_file) return false;
  return entry.type !== "others" || !!entry.custom_type_name.trim();
}

export interface ValidIdOptions {
  /**
   * Whether the form must end up with at least one usable ID. True for the
   * public membership application (KYC). False for admin member creation,
   * where staff may add a member now and collect IDs later — but any ID they
   * did start still has to be complete.
   */
  requireAtLeastOne?: boolean;
}

/**
 * Validates every row the person filled in. Returns one error per missing
 * field so the form can mark each one, ordered by row then by field.
 */
export function validateValidIds(
  entries: ValidIdDraft[],
  { requireAtLeastOne = true }: ValidIdOptions = {}
): ValidIdValidation {
  const errors: ValidIdError[] = [];

  entries.forEach((entry, index) => {
    if (entry.uploaded || isBlankValidId(entry)) return;

    // 1-based for the label the applicant actually sees ("ID 2").
    const label = `ID ${index + 1}`;

    if (!entry.type) {
      errors.push({
        index,
        field: "type",
        message: `Select an ID type for ${label}.`,
      });
    } else if (entry.type === "others" && !entry.custom_type_name.trim()) {
      errors.push({
        index,
        field: "custom_type_name",
        message: `Name the ID type for ${label}.`,
      });
    }

    if (!entry.id_number.trim()) {
      errors.push({
        index,
        field: "id_number",
        message: `Enter the ID number for ${label}.`,
      });
    }

    if (!entry.front_file) {
      errors.push({
        index,
        field: "front_file",
        message: `Upload the front of ${label}.`,
      });
    }
  });

  // KYC floor: the application needs one usable ID, mirroring the backend gate
  // that blocks approving a registration with none.
  if (requireAtLeastOne && !errors.length && !entries.some(isCompleteValidId)) {
    errors.push({
      index: 0,
      field: "type",
      message: "Please add at least one valid ID before continuing.",
    });
  }

  return { ok: errors.length === 0, errors };
}
