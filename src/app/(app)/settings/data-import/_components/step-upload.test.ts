import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkLabel, declaredFiles, formatBytes } from "./step-upload";

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

const SHARE_CAPITAL = { name: "share-capital.csv", size: 1024 };

test("a run declares the share capital file when picked, with or without the members file", () => {
  assert.deepEqual(declaredFiles({ customers: null, loans: null, share_capital: SHARE_CAPITAL }, { share_capital: "c".repeat(64) }), {
    share_capital: { filename: "share-capital.csv", size_bytes: 1024, sha256: "c".repeat(64) },
  });
  assert.deepEqual(
    Object.keys(
      declaredFiles(
        { customers: MEMBERS, loans: LOANS, share_capital: SHARE_CAPITAL },
        { customers: "a".repeat(64), loans: "b".repeat(64), share_capital: "c".repeat(64) },
      ),
    ),
    ["customers", "loans", "share_capital"],
  );
});

test("the run carries the date orders the Check step settled, which the server reads the dates with", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-upload.tsx"),
    "utf8",
  );
  // In the body that opens the run, beside the files.
  const body = source.slice(source.indexOf("api.rawPost<CreateRunBody>"), source.indexOf("const id = created?.run?.id"));
  assert.match(body, /files: declaredFiles\(/);
  assert.match(body, /date_orders: runDateOrders\(precheck\.dateFormat\)/);
});

test("the upload step opens a run without waiting for a loans file", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-upload.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /!customers \|\| !loans/);
  assert.match(source, /files: declaredFiles\(/);
  // Opened once the picked files make an import (./import-files), the share capital file alone included.
  assert.match(source, /filesProblem\(/);
});

test("the screen speaks of one file or both, from the run's own files (./import-files)", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-upload.tsx"),
    "utf8",
  );
  assert.match(source, /filesPhrase\(state\.files\.map\(\(file\) => file\.kind\)\)/);
  assert.doesNotMatch(source, /export function filesPhrase/, "one phrase book, shared with Processing and the result");
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
