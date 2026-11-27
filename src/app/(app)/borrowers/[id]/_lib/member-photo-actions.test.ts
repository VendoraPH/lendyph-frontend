import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { memberPhotoActions } from "./member-photo-actions";

test("a user who can edit members opens, uploads, changes and removes the photo", () => {
  assert.deepEqual(memberPhotoActions(true, true), { avatar: "view", change: true, remove: true });
  assert.deepEqual(memberPhotoActions(false, true), { avatar: "upload", change: true, remove: false });
});

test("a view-only user can open the photo, and nothing else", () => {
  assert.deepEqual(memberPhotoActions(true, false), { avatar: "view", change: false, remove: false });
  assert.deepEqual(memberPhotoActions(false, false), { avatar: null, change: false, remove: false });
});

test("the member page header offers Edit Profile and the photo controls only with borrowers:update", () => {
  const header = readFileSync(
    resolve(process.cwd(), "src/app/(app)/borrowers/[id]/_components/borrower-header.tsx"),
    "utf8",
  );
  assert.match(
    header,
    /<PermissionGate permission="borrowers:update">\s*<Button[\s\S]*?onClick=\{onEdit\}[\s\S]*?Edit Profile\s*<\/Button>\s*<\/PermissionGate>/,
  );
  assert.match(header, /memberPhotoActions\(Boolean\(borrower\.photo\), can\("borrowers:update"\)\)/);
});
