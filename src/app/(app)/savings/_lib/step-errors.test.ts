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

test("money coming in labels its reference by the method, as the server requires it, and shows a refusal on it", () => {
  for (const file of [
    // A deposit (required for bank transfer, GCash and Maya); the same dialog's withdrawal keeps it optional.
    "src/app/(app)/savings/accounts/[id]/_components/transaction-dialog.tsx",
    "src/app/(app)/savings/_components/open-account-dialog.tsx",
    "src/app/(app)/savings/time-deposits/_components/place-time-deposit-dialog.tsx",
    // A member's new account opened with its deposit; the same dialog's payout keeps it optional.
    "src/app/(app)/member-portal/requests/_components/decision-dialog.tsx",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /"Reference \(optional\)"/, file);
    assert.match(source, /referenceLabel\(/, file);
    assert.match(source, /serverFieldError\(err, "reference"\)|decisionReferenceRefusal\(request\.type, err\)/, file);
    assert.match(source, /error=\{referenceError \?\? /, file);
  }
});

test("money going out reads its reference as optional by every method, and shows a refusal on it", () => {
  // Finish run round 5: a payout's reference exists only once the money is sent, after any approval.
  for (const file of [
    "src/app/(app)/savings/accounts/[id]/_components/close-account-dialog.tsx",
    "src/app/(app)/savings/time-deposits/[id]/_components/settle-dialog.tsx",
    "src/app/(app)/savings/time-deposits/[id]/_components/preterminate-dialog.tsx",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /label="Reference \(optional\)"/, file);
    assert.doesNotMatch(source, /savingsReferenceError|aria-required/, file);
    assert.match(source, /serverFieldError\(err, "payout_reference"\)/, file);
    assert.match(source, /error=\{referenceError\}/, file);
  }
});
