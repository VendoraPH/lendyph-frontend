import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { extractGCashErrorMessage } from "./gcash-errors";

function failed(status: number, data: unknown): AxiosError {
  const err = new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST");
  err.response = {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return err;
}

const amount422 = (message: string) => failed(422, { message, errors: { amount: [message] } });

describe("extractGCashErrorMessage", () => {
  test("a 422 on amount reaches the user in the server's words", () => {
    const message = "Amount must be more than the ₱15.00 charge.";
    assert.equal(extractGCashErrorMessage(amount422(message)), message);
  });

  test("a 422 on amount that mentions a tier is still the server's words", () => {
    const message = "Amount must be more than this tier's ₱15.00 charge.";
    assert.equal(extractGCashErrorMessage(amount422(message)), message);
  });

  test("the no-tier refusal keeps its friendly copy", () => {
    assert.equal(
      extractGCashErrorMessage(amount422("No tier matches amount 99999. Check the configured tier ranges.")),
      "No tier covers this amount. Update GCash settings.",
    );
  });

  test("a 403 says the role can't record GCash transactions", () => {
    assert.equal(
      extractGCashErrorMessage(failed(403, { message: "This action is unauthorized." })),
      "You don't have permission to record GCash transactions.",
    );
  });
});
