import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkLabel, declaredFiles, filesPhrase, formatBytes } from "./step-upload";

const MEMBERS = { name: "members.csv", size: 2048 };
const LOANS = { name: "loans.csv", size: 4096 };

test("a run opens with the members file alone, and declares the loans file only when picked", () => {
  assert.deepEqual(declaredFiles({ customers: MEMBERS, loans: null }, { customers: "a".repeat(64) }), {
    customers: { filename: "members.csv", size_bytes: 2048, sha256: "a".repeat(64) },
  });
  assert.deepEqual(
    declaredFiles({ customers: MEMBERS, loans: LOANS }, { customers: "a".repeat(64), loans: "b".repeat(64) }),
    {
      customers: { filename: "members.csv", size_bytes: 2048, sha256: "a".repeat(64) },
      loans: { filename: "loans.csv", size_bytes: 4096, sha256: "b".repeat(64) },
    },
  );
});

test("the upload step opens a run without waiting for a loans file", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-upload.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /!customers \|\| !loans/);
  assert.match(source, /files: declaredFiles\(/);
});

test("the screen speaks of one file or both, never both when there is one", () => {
  assert.deepEqual(filesPhrase(["customers"]), {
    verified: "The members file is on the server and verified",
    announced: "The members file is uploaded and verified.",
    sent: "of the members file sent",
  });
  assert.deepEqual(filesPhrase(["customers", "loans"]), {
    verified: "Both files are on the server and verified",
    announced: "Both files uploaded and verified.",
    sent: "of both files sent",
  });
});

test("pieces are numbered from one on screen, and from zero on the wire", () => {
  // The admin is counting things, not indexing an array. Chunk 0 is "Piece 1".
  assert.equal(chunkLabel(0, 7), "Piece 1 of 7");
  assert.equal(chunkLabel(6, 7), "Piece 7 of 7");
});

test("nothing in flight and nothing planned produce no label rather than a wrong one", () => {
  assert.equal(chunkLabel(null, 7), null);
  assert.equal(chunkLabel(0, 0), null);
});

test("sizes are readable at every scale a coop's export reaches", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(262_144), "256.0 KB");
  assert.equal(formatBytes(1_890_697), "1.8 MB");
});

test("a size that is zero, negative or not a number reads as zero, never as NaN", () => {
  assert.equal(formatBytes(0), "0 KB");
  assert.equal(formatBytes(-1), "0 KB");
  assert.equal(formatBytes(Number.NaN), "0 KB");
});
