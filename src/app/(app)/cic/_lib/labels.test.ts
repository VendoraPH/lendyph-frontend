import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicCapture } from "@/types/cic";
import { fileCaptures, staffName } from "./labels";

const capture = (id: number, kind: CicCapture["kind"], status: CicCapture["status"] = "complete") => ({ id, kind, status });

test("a standard file is built from a complete month-end capture, or a test one only while the server allows it", () => {
  const all = [
    capture(1, "month_end"),
    capture(2, "month_end", "failed"),
    capture(3, "test"),
    capture(4, "correction"),
    capture(5, "month_end", "capturing"),
  ];
  assert.deepEqual(fileCaptures(all, false).map((c) => c.id), [1]);
  assert.deepEqual(fileCaptures(all, true).map((c) => c.id), [1, 3]);
});

test("a staff member reads by name, and the schedule (no one) by the caller's words", () => {
  assert.equal(staffName({ id: 4, name: "Ana Cruz" }), "Ana Cruz");
  assert.equal(staffName({ id: 4, name: null }), "User #4");
  assert.equal(staffName(null, "The schedule"), "The schedule");
});
