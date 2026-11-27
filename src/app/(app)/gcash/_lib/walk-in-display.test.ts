import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { walkInDetails, walkInIdLabel } from "./walk-in-display";

describe("walkInIdLabel", () => {
  test("shows the ID type and number", () => {
    assert.equal(
      walkInIdLabel({
        id_type: "UMID",
        id_number: "1234-5678",
        mobile_number: "0917",
      }),
      "UMID · 1234-5678",
    );
  });

  test("is null for a walk-in without an ID", () => {
    assert.equal(
      walkInIdLabel({ id_type: null, id_number: null, mobile_number: "0917" }),
      null,
    );
    assert.equal(
      walkInIdLabel({ id_type: "", id_number: " ", mobile_number: "0917" }),
      null,
    );
  });

  test("a half-filled pair never shows null or a stray separator", () => {
    assert.equal(
      walkInIdLabel({
        id_type: "UMID",
        id_number: null,
        mobile_number: "0917",
      }),
      "UMID",
    );
    assert.equal(
      walkInIdLabel({
        id_type: null,
        id_number: "1234",
        mobile_number: "0917",
      }),
      "1234",
    );
  });
});

describe("walkInDetails", () => {
  test("joins the ID and the mobile number", () => {
    assert.equal(
      walkInDetails({
        id_type: "UMID",
        id_number: "1234",
        mobile_number: "09171234567",
      }),
      "UMID · 1234 · 09171234567",
    );
  });

  test("REGRESSION: a walk-in without an ID shows only the mobile number", () => {
    const details = walkInDetails({
      id_type: null,
      id_number: null,
      mobile_number: "09171234567",
    });
    assert.equal(details, "09171234567");
    assert.doesNotMatch(details, /null|·/);
  });
});
