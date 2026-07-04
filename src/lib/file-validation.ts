// Shared client-side upload validation so users get immediate feedback
// (too large / unsupported type) before a file is ever submitted.

export const MAX_UPLOAD_SIZE_MB = 5;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Valid-ID files are uploaded as-is (not re-encoded), so this list must match
// exactly what the backend accepts: jpg, jpeg, png, pdf. webp is intentionally
// excluded — it passes a generic image check but the server rejects it.
export const ID_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
};

function formatTypeList(types: string[]): string {
  return types.map((t) => TYPE_LABELS[t] ?? t).join(", ");
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
    return {
      ok: false,
      error: `File is too large (max ${MAX_UPLOAD_SIZE_MB}MB).`,
    };
  }
  return { ok: true };
}