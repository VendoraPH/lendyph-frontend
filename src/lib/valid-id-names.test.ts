import { test } from "node:test";
import assert from "node:assert/strict";
import { removeValidIdRowLabel, validIdRowName, validIdTypeLabel } from "./valid-id-names";

test("an ID type reads in words, or by the name typed for Others", () => {
  assert.equal(validIdTypeLabel("drivers_license", null), "Driver's License");
  assert.equal(validIdTypeLabel("others", "Company ID"), "Company ID");
  assert.equal(validIdTypeLabel("others", ""), "Others");
  assert.equal(validIdTypeLabel("unknown_type", null), "unknown_type");
});

test("an ID row is named by its type and its place in the list", () => {
  assert.equal(validIdRowName({ type: "", custom_type_name: "" }, 0), "ID 1");
  assert.equal(validIdRowName({ type: "passport", custom_type_name: "" }, 1), "Passport (ID 2)");
  assert.equal(validIdRowName({ type: "others", custom_type_name: " Company ID " }, 2), "Company ID (ID 3)");
});

test("the row's remove button names the row", () => {
  assert.equal(removeValidIdRowLabel({ type: "", custom_type_name: "" }, 1), "Remove ID 2");
  assert.equal(removeValidIdRowLabel({ type: "passport", custom_type_name: "" }, 0), "Remove Passport (ID 1)");
});
