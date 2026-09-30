import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { coMakerName } from "./co-maker-name";

describe("coMakerName", () => {
  test("prefers the API's full_name", () => {
    assert.equal(coMakerName({ full_name: "Carla Diaz", first_name: "C." }), "Carla Diaz");
  });

  test("joins the parts, skipping the ones not on file", () => {
    assert.equal(
      coMakerName({ first_name: "Juan", middle_name: undefined, last_name: "Dela Cruz", suffix: "Jr." }),
      "Juan Dela Cruz Jr.",
    );
  });

  test("is empty when there is no name at all", () => {
    assert.equal(coMakerName({}), "");
  });
});
