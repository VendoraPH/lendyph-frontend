import { getErrorMessage } from "@/lib/api-error";

/**
 * The toast for an upload that failed after the member's details were saved:
 * the details are kept, and the server's own words say why the file wasn't
 * (a 422's field message, else its message).
 */
export function uploadFailureMessage(
  what: "photo" | "ID",
  err: unknown,
  { saved = "Member details saved", hint }: { saved?: string; hint?: string } = {},
): { title: string; description: string } {
  const reason = getErrorMessage(err, "Please try again.");
  return {
    title: `${saved}, but the ${what} upload failed`,
    description: hint ? `${reason} ${hint}` : reason,
  };
}

/**
 * Where the new member page goes after a create. The member exists once it's
 * created, so a failed upload is never retried from the create form (saving it
 * again would create the member twice). It goes to the member's edit page,
 * where the photo and IDs can be added again, or to the member's page when the
 * user can't edit members.
 */
export function afterCreate(
  memberId: number,
  anyFailed: boolean,
  can: (permission: "borrowers:update" | "borrowers:view") => boolean,
): { path: string; retryHere: boolean } {
  if (!anyFailed) return { path: "/borrowers", retryHere: false };
  if (can("borrowers:update") && can("borrowers:view")) {
    return { path: `/borrowers/${memberId}/edit`, retryHere: true };
  }
  if (can("borrowers:view")) return { path: `/borrowers/${memberId}`, retryHere: false };
  return { path: "/borrowers", retryHere: false };
}

export interface MemberUploadsResult<T> {
  photoError: unknown | null;
  /** The IDs that weren't saved, in order, to keep on the form for a retry. */
  failedIds: { entry: T; error: unknown }[];
  anyFailed: boolean;
}

/**
 * Upload the photo, then each ID, after the member's details were saved. A
 * failure never stops the rest. The result says which failed, so the page can
 * keep only those for a retry and never send a saved one twice.
 */
export async function uploadMemberFiles<P, T>({
  photo,
  ids,
  uploadPhoto,
  uploadId,
}: {
  photo: P | null;
  ids: T[];
  uploadPhoto: (photo: P) => Promise<unknown>;
  uploadId: (entry: T) => Promise<unknown>;
}): Promise<MemberUploadsResult<T>> {
  let photoError: unknown | null = null;
  if (photo !== null) {
    try {
      await uploadPhoto(photo);
    } catch (err) {
      photoError = err;
    }
  }

  const failedIds: { entry: T; error: unknown }[] = [];
  for (const entry of ids) {
    try {
      await uploadId(entry);
    } catch (error) {
      failedIds.push({ entry, error });
    }
  }

  return { photoError, failedIds, anyFailed: photoError !== null || failedIds.length > 0 };
}
