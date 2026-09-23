import test from "node:test";
import assert from "node:assert/strict";

import { ID_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, validateUploadFile } from "./file-validation";

function aFile(size: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(size)], "id.jpg", { type });
}

test("the default limit is still reported as 5MB", () => {
  assert.deepEqual(validateUploadFile(aFile(MAX_UPLOAD_SIZE_BYTES + 1), ID_MIME_TYPES), {
    ok: false,
    error: "File is too large (max 5MB).",
  });
});

test("a caller's own limit is the one the message reports", () => {
  // It used to say "max 5MB" whatever limit was actually applied.
  const tenMb = 10 * 1024 * 1024;
  assert.equal(validateUploadFile(aFile(tenMb), ID_MIME_TYPES, tenMb).ok, true);
  assert.deepEqual(validateUploadFile(aFile(tenMb + 1), ID_MIME_TYPES, tenMb), {
    ok: false,
    error: "File is too large (max 10MB).",
  });
});
