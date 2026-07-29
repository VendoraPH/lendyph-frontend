import { test } from "node:test";
import assert from "node:assert/strict";
import { formatValidationMessage } from "./validation-message";

test("single field reads as one line", () => {
  assert.equal(formatValidationMessage(["Email"]), "Please enter a valid Email.");
});

test("two fields join with 'and'", () => {
  assert.equal(
    formatValidationMessage(["First name", "Email"]),
    "Please complete: First name and Email."
  );
});

test("three+ fields comma-join with 'and'", () => {
  assert.equal(
    formatValidationMessage(["First name", "Email", "Province"]),
    "Please complete: First name, Email, and Province."
  );
});

test("empty list falls back to generic prompt", () => {
  assert.equal(formatValidationMessage([]), "Please complete the required fields.");
});

test("blank/whitespace entries are ignored", () => {
  assert.equal(formatValidationMessage([" ", "Email", ""]), "Please enter a valid Email.");
});
