import assert from "node:assert/strict";
import { test } from "node:test";

import { cicRefusal } from "./refusal";

test("a refusal's code and validation counts are read from the server's body", () => {
  const validation = { errors: 0, warnings: 2, top_issues: [] };
  const err = { response: { status: 422, data: { message: "Review the warnings.", code: "warnings_unconfirmed", data: { validation } } } };
  assert.deepEqual(cicRefusal(err), { code: "warnings_unconfirmed", validation });
});

test("anything else carries no code and no counts", () => {
  assert.deepEqual(cicRefusal(new Error("offline")), { code: null, validation: null });
  assert.deepEqual(cicRefusal({ response: { data: { code: "x", data: { validation: { errors: "1" } } } } }), {
    code: "x",
    validation: null,
  });
});
