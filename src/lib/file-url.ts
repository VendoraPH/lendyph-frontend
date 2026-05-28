import { env } from "@/config/env";

/**
 * Resolve a backend-provided file path to a fully-qualified URL.
 *
 * The API returns media references in two shapes depending on the endpoint:
 * already-absolute URLs (`https://.../storage/...`) and storage-relative
 * paths. Absolute URLs are returned untouched; relative paths are prefixed
 * with the configured storage base so `<img src>` / `window.open` resolve.
 */
export function fileUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.storage.url || ""}${url}`;
}

/**
 * Best-effort fetch of a stored image back into a File so it can be re-uploaded
 * (e.g. preserving the unchanged side when replacing one side of a valid ID).
 * Storage is typically cross-origin, so this can fail on CORS — callers must
 * handle a null return.
 */
export async function urlToFile(
  url: string | null | undefined,
  filename: string
): Promise<File | null> {
  const resolved = fileUrl(url);
  if (!resolved) return null;
  try {
    const res = await fetch(resolved);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}