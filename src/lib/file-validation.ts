// Shared client-side upload validation so users get immediate feedback
// (too large / unsupported type) before a file is ever submitted.

export const MAX_UPLOAD_SIZE_MB = 5;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Valid-ID files are uploaded as-is (not re-encoded), so this list must match
// exactly what the backend accepts: jpg, jpeg, png, pdf. webp is intentionally
// excluded — it passes a generic image check but the server rejects it.
export const ID_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// The file names a Documents tab and an accounting attachment take, the same
// list the server checks. .jpe and .jfif are JPEG names too, so "JPG" in the
// on-screen hint covers them.
export const DOCUMENT_EXTENSIONS = [".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".pdf", ".doc", ".docx"] as const;

/** For a file input's `accept`. */
export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.join(",");

// The file names a member's valid ID takes, the server's valid ID list.
export const ID_EXTENSIONS = [".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".pdf"] as const;

/** For a valid ID file input's `accept`. */
export const ID_ACCEPT = ID_EXTENSIONS.join(",");

/**
 * Why a picked file can't be a valid ID by its name, or `null` when it can.
 * The picker's `accept` is only a hint (the file dialog can show all files),
 * so a .bat or a .heic is refused here, before any preview is read.
 */
export function idFileNameProblem(name: string): string | null {
  const lower = name.toLowerCase();
  return ID_EXTENSIONS.some((extension) => lower.endsWith(extension))
    ? null
    : "This file can't be used as an ID. Please choose a JPG, PNG or PDF file.";
}

const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
};

function formatTypeList(types: string[]): string {
  return types.map((t) => TYPE_LABELS[t] ?? t).join(", ");
}

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateUploadFile(
  file: File,
  acceptedTypes: string[],
  maxBytes: number = MAX_UPLOAD_SIZE_BYTES
): FileValidationResult {
  if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type. Please use ${formatTypeList(acceptedTypes)}.`,
    };
  }
  if (file.size > maxBytes) {
    // The limit in the message is the one actually applied. It was the 5 MB
    // default whatever `maxBytes` said, so a caller with another limit (the
    // valid-ID endpoints take 10 MB) reported a number it wasn't enforcing.
    return {
      ok: false,
      error: `File is too large (max ${formatMegabytes(maxBytes)}MB).`,
    };
  }
  return { ok: true };
}