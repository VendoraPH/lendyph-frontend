import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { signOffRefusal, signOffRefusalFor } from "./sign-off-refusal";

const LEFT_OUT_STEP_APPLIES =
  'The principal is now ₱90,000.00, so the "Head Office" step (from ₱50,000.00) applies. Send the loan back to the Submit step so its approval chain is set again.';

const answer = (status: number, errors?: Record<string, unknown>, message?: string) => ({
  response: { status, data: { message, errors } },
});

describe("signOffRefusal", () => {
  test("a sign-off refused because a left-out step now applies gives the server's sentence as it is", () => {
    assert.equal(signOffRefusal(answer(422, { approval: [LEFT_OUT_STEP_APPLIES] })), LEFT_OUT_STEP_APPLIES);
  });

  test("a refusal on another field is not this one", () => {
    assert.equal(signOffRefusal(answer(422, { forward_to_user_id: ["Pick someone else."] })), null);
  });

  test("other answers and thrown values give nothing", () => {
    assert.equal(signOffRefusal(answer(409, undefined, "Another change to this loan was saved at the same time.")), null);
    assert.equal(signOffRefusal(answer(422, { approval: [] })), null);
    assert.equal(signOffRefusal(answer(422, { approval: "not a list" })), null);
    assert.equal(signOffRefusal(new Error("offline")), null);
    assert.equal(signOffRefusal(null), null);
  });
});

describe("signOffRefusalFor", () => {
  test("the refusal shows only on the step it was made on", () => {
    const kept = { key: "41", message: LEFT_OUT_STEP_APPLIES };
    assert.equal(signOffRefusalFor(kept, "41"), LEFT_OUT_STEP_APPLIES);
    assert.equal(signOffRefusalFor(kept, "42"), null);
    assert.equal(signOffRefusalFor(null, "41"), null);
  });
});
