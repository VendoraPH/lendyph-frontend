/**
 * Saving the registration review's valid IDs, so a refused upload never loses an
 * ID already on file. Pure apart from the calls passed in, so it runs under
 * `tsx --test`.
 *
 * Why a replacement isn't always uploaded first: DELETE /valid-ids/{id} removes
 * every document sharing the ID's type and number (`ValidIdService::delete`), and
 * there is no update endpoint. A replacement with the same type and number would
 * be deleted along with the old ID. So only that case deletes first, after copying
 * the old files, and puts them back if the upload is refused. Every other case
 * uploads first and deletes after.
 */
import { isBlankValidId, validateValidIds } from "@/lib/valid-id";
import type { RegistrationValidId } from "@/services/registration.service";
import type { ValidIdDraft } from "../_components/registration-valid-ids-editor";

export interface ValidIdSyncDeps {
  /** Readies a picked file for upload (image compression). */
  prepare: (file: File) => Promise<File>;
  /** Copies a stored file; null when it can't be read. */
  fetchExisting: (url: string | null | undefined, filename: string) => Promise<File | null>;
  upload: (data: FormData) => Promise<unknown>;
  /** Deletes an ID; one that is already gone counts as deleted. */
  remove: (id: number) => Promise<void>;
}

/** A failure whose message is written for the user, and is shown as it is. */
export class ValidIdSyncError extends Error {}

const COPY_FAILED =
  "We couldn't copy the ID on file, so nothing was changed. Please try again, or upload both sides.";
const RESTORE_FAILED =
  "The new ID was refused and the old one was removed and couldn't be put back. Please upload it again.";

function isReplaced(draft: ValidIdDraft): boolean {
  return draft.id != null && (draft.front_file != null || draft.back_file != null);
}

/** Whether saving this row uploads anything: a replacement, or a new row in use. */
function isUploadRow(draft: ValidIdDraft): boolean {
  return draft.id == null ? !isBlankValidId(draft) : isReplaced(draft);
}

/**
 * What's wrong with the rows that would upload, in the words the member form
 * uses, numbered as the screen shows them. Empty when the save can go ahead.
 */
export function validIdDraftErrors(drafts: ValidIdDraft[]): string[] {
  const rows = drafts.map((draft) => ({
    type: draft.type,
    custom_type_name: draft.custom_type_name,
    id_number: draft.id_number,
    back_file: draft.back_file,
    // A front already on file counts: the save copies it across.
    front_file:
      draft.front_file ?? (draft.front_existing_url ? new File([], "front-on-file") : null),
    uploaded: !isUploadRow(draft),
  }));
  return validateValidIds(rows, { requireAtLeastOne: false }).errors.map((e) => e.message);
}

/** An ID on file with no number can't be replaced until it has one. */
export function showsIdNumberInput(draft: ValidIdDraft): boolean {
  return isReplaced(draft) && !draft.stored_id_number.trim();
}

/** What the server groups a valid ID's documents by. */
function identity(type: string, idNumber: string | null | undefined): string {
  return `${type}|${(idNumber ?? "").trim().toLowerCase()}`;
}

function formData(
  type: string,
  customTypeName: string | null | undefined,
  idNumber: string | null | undefined,
  front: File | null,
  back: File | null,
): FormData {
  const data = new FormData();
  data.append("type", type);
  const name = customTypeName?.trim();
  if (type === "others" && name) data.append("custom_type_name", name);
  const number = idNumber?.trim();
  if (number) data.append("id_number", number);
  if (front) data.append("front_file", front);
  if (back) data.append("back_file", back);
  return data;
}

async function replaceSameIdentity(
  draft: ValidIdDraft,
  old: RegistrationValidId,
  deps: ValidIdSyncDeps,
): Promise<void> {
  const oldFront = await deps.fetchExisting(old.front_url, "front.jpg");
  const oldBack = await deps.fetchExisting(old.back_url, "back.jpg");
  if ((old.front_url && !oldFront) || (old.back_url && !oldBack)) {
    throw new ValidIdSyncError(COPY_FAILED);
  }

  const replacing = draft.id != null;
  const front = draft.front_file
    ? await deps.prepare(draft.front_file)
    : replacing
      ? oldFront
      : null;
  const back = draft.back_file
    ? await deps.prepare(draft.back_file)
    : replacing
      ? oldBack
      : null;

  await deps.remove(old.id);
  try {
    await deps.upload(formData(draft.type, draft.custom_type_name, draft.id_number, front, back));
  } catch (refusal) {
    try {
      await deps.upload(
        formData(old.type, old.custom_type_name, old.id_number, oldFront, oldBack),
      );
    } catch {
      throw new ValidIdSyncError(RESTORE_FAILED);
    }
    throw refusal;
  }
}

async function uploadThenDeleteOld(draft: ValidIdDraft, deps: ValidIdSyncDeps): Promise<void> {
  const front = draft.front_file
    ? await deps.prepare(draft.front_file)
    : await deps.fetchExisting(draft.front_existing_url, "front.jpg");
  const back = draft.back_file
    ? await deps.prepare(draft.back_file)
    : await deps.fetchExisting(draft.back_existing_url, "back.jpg");
  if (
    (!draft.front_file && draft.front_existing_url && !front) ||
    (!draft.back_file && draft.back_existing_url && !back)
  ) {
    throw new ValidIdSyncError(COPY_FAILED);
  }

  await deps.upload(formData(draft.type, draft.custom_type_name, draft.id_number, front, back));
  if (draft.id != null) await deps.remove(draft.id);
}

/**
 * Brings the IDs on file in line with the editor. Rows that replace an ID of the
 * same type and number go first, so their delete can't take another row's upload.
 * IDs removed from the editor go last, once everything new is on file.
 */
export async function syncValidIdDrafts(
  onFile: RegistrationValidId[],
  drafts: ValidIdDraft[],
  deps: ValidIdSyncDeps,
): Promise<void> {
  const keptIds = new Set(drafts.flatMap((draft) => (draft.id != null ? [draft.id] : [])));
  const handled = new Set<number>();

  const sameIdentityAs = (draft: ValidIdDraft) =>
    onFile.find(
      (item) =>
        (item.id === draft.id || !keptIds.has(item.id)) &&
        !handled.has(item.id) &&
        identity(item.type, item.id_number) === identity(draft.type, draft.id_number),
    );

  const uploads = drafts.filter(isUploadRow);
  const others: ValidIdDraft[] = [];

  for (const draft of uploads) {
    const old = sameIdentityAs(draft);
    if (!old) {
      others.push(draft);
      continue;
    }
    handled.add(old.id);
    await replaceSameIdentity(draft, old, deps);
  }

  for (const draft of others) {
    await uploadThenDeleteOld(draft, deps);
  }

  for (const item of onFile) {
    if (!keptIds.has(item.id) && !handled.has(item.id)) await deps.remove(item.id);
  }
}
