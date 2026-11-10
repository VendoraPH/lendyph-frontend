import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DOCUMENT_ACCEPT,
  DOCUMENT_EXTENSIONS,
  ID_ACCEPT,
  ID_EXTENSIONS,
  ID_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  idFileNameProblem,
  validateUploadFile,
} from "./file-validation";

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

test("documents and attachments take the same names the server does, .jpe and .jfif included", () => {
  assert.deepEqual(
    [...DOCUMENT_EXTENSIONS],
    [".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".pdf", ".doc", ".docx"],
  );
  assert.equal(DOCUMENT_ACCEPT, ".jpg,.jpeg,.jpe,.jfif,.png,.pdf,.doc,.docx");
});

// A picker that lists JPEG names itself drifts from the server: .jpe and .jfif
// were missing from every such copy. One that takes image/* already has them.
test("every document picker that lists JPEG names reads the shared list", () => {
  const root = join(process.cwd(), "src");
  const pickers = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx"))
    .filter((path) => /accept="[^"]*\.jpe?g[,"]/.test(readFileSync(join(root, path), "utf8")));
  assert.deepEqual(pickers, []);
});

test("valid ID pickers take the server's valid ID list, .jpe and .jfif included", () => {
  assert.deepEqual([...ID_EXTENSIONS], [".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".pdf"]);
  assert.equal(ID_ACCEPT, ".jpg,.jpeg,.jpe,.jfif,.png,.pdf");
});

test("an ID file whose name isn't on the valid ID list is refused, in words", () => {
  for (const name of ["run.bat", "photo.heic", "scan.webp", "notes.docx", "ID", "id.jpg.exe", ""]) {
    assert.equal(
      idFileNameProblem(name),
      "This file can't be used as an ID. Please choose a JPG, PNG or PDF file.",
      name,
    );
  }
});

test("every name on the valid ID list is accepted, in any case", () => {
  for (const name of ["front.jpg", "front.JPEG", "scan.jpe", "scan.JFIF", "back.png", "id.Pdf", "my.id.pdf"]) {
    assert.equal(idFileNameProblem(name), null, name);
  }
});

test("both member forms check an ID file's name before reading its preview", () => {
  for (const path of ["src/app/(app)/borrowers/new/page.tsx", "src/app/(app)/borrowers/[id]/edit/page.tsx"]) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    const start = source.indexOf("function handleValidIdFile(");
    assert.notEqual(start, -1, path);
    const handler = source.slice(start, source.indexOf("reader.readAsDataURL(file);", start));
    const check = handler.indexOf("idFileNameProblem(file.name)");
    assert.notEqual(check, -1, `${path}: checks the name`);
    assert.ok(check < handler.indexOf("new FileReader()"), `${path}: before the preview`);
  }
});
