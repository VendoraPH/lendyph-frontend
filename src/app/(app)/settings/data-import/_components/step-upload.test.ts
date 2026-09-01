import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkLabel, formatBytes } from "./step-upload";

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
