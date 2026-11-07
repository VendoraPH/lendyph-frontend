/**
 * The document type a Documents screen sends for a file: its extension, in lower
 * case. A name with no dot, or an extension that isn't plain letters and digits,
 * is "file", because the server limits a type to safe characters (422).
 */
export function documentTypeFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  const extension = dot === -1 ? "" : name.slice(dot + 1);
  return /^[A-Za-z0-9]{1,50}$/.test(extension) ? extension.toLowerCase() : "file";
}
