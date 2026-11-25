import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serverFieldError } from "./step-errors";

const DUPLICATE =
  'Reference "GC-DUP-1" is already on record for another GCash transaction. Check the reference and enter the right one.';

test("a 422 on the reference reads the server's own words for that field", () => {
  const refused = { response: { status: 422, data: { message: DUPLICATE, errors: { reference: [DUPLICATE] } } } };
  assert.equal(serverFieldError(refused, "reference"), DUPLICATE);
  assert.equal(serverFieldError(refused, "amount"), null);
});

test("any other answer leaves the field alone", () => {
  assert.equal(serverFieldError({ response: { status: 409, data: { errors: { reference: ["x"] } } } }, "reference"), null);
  assert.equal(serverFieldError({ response: { status: 422, data: { errors: { reference: [] } } } }, "reference"), null);
  assert.equal(serverFieldError(new Error("offline"), "reference"), null);
  assert.equal(serverFieldError(null, "reference"), null);
});

test("each savings form with a typed reference reads it as optional, as the server does, and shows a refusal on it", () => {
  for (const file of [
    "src/app/(app)/savings/accounts/[id]/_components/transaction-dialog.tsx",
    "src/app/(app)/savings/_components/open-account-dialog.tsx",
    "src/app/(app)/savings/time-deposits/_components/place-time-deposit-dialog.tsx",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /"Reference \(optional\)"/, file);
    assert.match(source, /serverFieldError\(err, "reference"\)/, file);
    assert.match(source, /error=\{referenceError\}/, file);
  }
});
