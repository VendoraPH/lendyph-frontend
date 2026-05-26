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