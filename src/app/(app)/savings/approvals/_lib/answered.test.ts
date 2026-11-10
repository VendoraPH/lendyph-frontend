import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serverAnswered } from "./approval-rules";

const DIALOG = join(process.cwd(), "src/app/(app)/savings/approvals/_components/decide-dialog.tsx");

test("the approvals queue reloads after a refusal as well as after success", () => {
  const source = readFileSync(DIALOG, "utf8");
  const catchBlock = source.slice(source.indexOf(".catch("));
  assert.match(catchBlock, /onDecided\(\)/, "the catch reloads the queue");
  assert.match(catchBlock, /serverAnswered\(err\)/, "a server answer closes the dialog");
});

test("a 409, 403 or 422 is an answer; a dropped connection is not", () => {
  for (const status of [409, 403, 422, 500]) assert.equal(serverAnswered({ response: { status } }), true, String(status));
  assert.equal(serverAnswered(new Error("Network Error")), false);
  assert.equal(serverAnswered(null), false);
});
