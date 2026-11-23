/** The file name in a `Content-Disposition` header, if any. */
export function filenameFrom(disposition: unknown): string | null {
  if (typeof disposition !== "string") return null;
  const star = /filename[*]=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}
