import { getErrorMessage } from "@/lib/api-error";

/**
 * The toast for an upload that failed after the member's details were saved:
 * the details are kept, and the server's own words say why the file wasn't
 * (a 422's field message, else its message).
 */
export function uploadFailureMessage(
  what: "photo" | "ID",
  err: unknown,
): { title: string; description: string } {
  return {
    title: `Member details saved, but the ${what} upload failed`,
    description: getErrorMessage(err, "Please try again."),
  };
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
