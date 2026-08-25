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
 * Append a cache-busting `v` param so a replaced image is refetched.
 *
 * Needed when the backend reuses a storage path across uploads: the URL is
 * then byte-identical before and after, and the browser would serve the old
 * cached image. A falsy version returns the URL untouched, so first paint
 * stays cacheable.
 */
export function withVersion(url: string, version: number): string {
  if (!url || !version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

/**
 * Best-effort fetch of a stored image back into a File so it can be re-uploaded
 * (e.g. preserving the unchanged side when replacing one side of a valid ID).
 *
 * These URLs are expiring signed links to `/api/files/documents/{id}`, not
 * `/storage/**` paths — KYC files moved to the private disk and are streamed by
 * FileController. So they are under `api/*` and covered by the API's CORS
 * config. Still best-effort: a link that has passed its 30-minute TTL returns
 * 403, so callers must handle a null return.
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