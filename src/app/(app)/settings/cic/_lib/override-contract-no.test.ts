import assert from "node:assert/strict";
import { test } from "node:test";

import { contractNoChange, overrideRemoveBlockedReason } from "./override-contract-no";

const adding = { editing: false, locked: false };
const editing = { editing: true, locked: false };

test("a new override sends a contract number only when one is typed", () => {
  assert.deepEqual(contractNoChange(null, "", adding), {});
  assert.deepEqual(contractNoChange(null, "  ", adding), {});
  assert.deepEqual(contractNoChange(null, " BC-2026-0007 ", adding), { contract_no: "BC-2026-0007" });
});

test("an edit leaves the number out to keep it, and sends null only to clear it", () => {
  assert.deepEqual(contractNoChange("BC-7", "BC-7", editing), {});
  assert.deepEqual(contractNoChange("BC-7", " BC-7 ", editing), {});
  assert.deepEqual(contractNoChange("BC-7", "BC-8", editing), { contract_no: "BC-8" });
  assert.deepEqual(contractNoChange("BC-7", "", editing), { contract_no: null });
  assert.deepEqual(contractNoChange(null, "", editing), {});
  assert.deepEqual(contractNoChange(null, "BC-9", editing), { contract_no: "BC-9" });
});

test("a number a submitted file carries is never sent", () => {
  assert.deepEqual(contractNoChange("BC-7", "", { editing: true, locked: true }), {});
  assert.deepEqual(contractNoChange("BC-7", "BC-8", { editing: true, locked: true }), {});
});

test("the browser doesn't judge the form: the reserved loan- form goes to the server, which refuses it in words", () => {
  assert.deepEqual(contractNoChange(null, "loan-12", adding), { contract_no: "loan-12" });
});

test("an override whose number a submitted file carries can't be removed, and says why", () => {
  assert.equal(
    overrideRemoveBlockedReason({ contract_no_reported: true }),
    "A file submitted to CIC carries this number, so the override stays.",
  );
  assert.equal(overrideRemoveBlockedReason({ contract_no_reported: false }), null);
});
