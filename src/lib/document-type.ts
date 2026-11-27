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

// File types by stored type, in lower case. A JPEG has four names, and a Word
// document two.
const TYPE_LABELS: Readonly<Record<string, string>> = {
  jpg: "JPG",
  jpeg: "JPG",
  jpe: "JPG",
  jfif: "JPG",
  png: "PNG",
  pdf: "PDF",
  doc: "Word",
  docx: "Word",
};

/**
 * A stored document type in words, for the Documents screens: "JPG" for any
 * JPEG name (.jfif, .jpe), "Word" for .doc and .docx, and any other type
 * (an older "barangay_clearance") in words.
 */
export function documentTypeLabel(type: string): string {
  const key = type.trim().toLowerCase();
  if (Object.hasOwn(TYPE_LABELS, key)) return TYPE_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
