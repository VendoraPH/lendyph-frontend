/**
 * A signed link the server sent, when it is an http(s) URL; otherwise null, so
 * the screen shows no link. The browser never builds a file link itself.
 */
export function signedUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}
