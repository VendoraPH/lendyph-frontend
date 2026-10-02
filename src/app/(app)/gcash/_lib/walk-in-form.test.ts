import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  ID_NUMBER_NOT_BLANK,
  WALK_IN_MAX_LENGTH,
  validateWalkInForm,
  walkInFieldErrors,
  walkInPayload,
  type WalkInFormState,
} from "./walk-in-form";

const FILLED: WalkInFormState = {
  full_name: "Juan Dela Cruz",
  mobile_number: "09171234567",
  id_type: "UMID",
  id_number: "0111-2222333-4",
  remarks: "",
};

/** The shape axios rejects with for an HTTP error reply. */
function httpError(status: number, data: unknown) {
  return { response: { status, data } };
}

const DUPLICATE =
  "A walk-in with this ID type and ID number is already registered. Search for them instead of adding them again.";

describe("input limits", () => {
  test("match StoreGCashNonMemberRequest", () => {
    assert.deepEqual(WALK_IN_MAX_LENGTH, {
      full_name: 255,
      mobile_number: 32,
      id_type: 64,
      id_number: 64,
      remarks: 2000,
    });
  });
});

describe("ID number made only of dashes or spaces", () => {
  for (const idNumber of ["---", "-", "- -", " - - ", "-- --"]) {
    test(`REGRESSION: ${JSON.stringify(idNumber)} is refused before submitting`, () => {
      assert.deepEqual(validateWalkInForm({ ...FILLED, id_number: idNumber }), {
        id_number: ID_NUMBER_NOT_BLANK,
      });
    });
  }

  test("uses the backend's own wording", () => {
    assert.equal(
      ID_NUMBER_NOT_BLANK,
      "The ID number must contain letters or numbers, not only dashes or spaces.",
    );
  });

  for (const idNumber of ["1234-5678", "A", "-1-", "ab 12"]) {
    test(`${JSON.stringify(idNumber)} is accepted`, () => {
      assert.deepEqual(validateWalkInForm({ ...FILLED, id_number: idNumber }), {});
    });
  }
});

describe("server validation errors on their fields", () => {
  test("REGRESSION: the duplicate-ID 422 lands on the ID number field", () => {
    const err = httpError(422, {
      message: DUPLICATE,
      errors: { id_number: [DUPLICATE] },
    });
    assert.deepEqual(walkInFieldErrors(err), { id_number: DUPLICATE });
  });

  test("every field the server names gets its first message", () => {
    const err = httpError(422, {
      message: "The full name field is required. (and 2 more errors)",
      errors: {
        full_name: ["The full name field is required."],
        mobile_number: [
          "The mobile number field must not be greater than 32 characters.",
          "second message",
        ],
        remarks: ["The remarks field must not be greater than 2000 characters."],
      },
    });
    assert.deepEqual(walkInFieldErrors(err), {
      full_name: "The full name field is required.",
      mobile_number:
        "The mobile number field must not be greater than 32 characters.",
      remarks: "The remarks field must not be greater than 2000 characters.",
    });
  });

  test("fields the form does not have are left for the toast", () => {
    const err = httpError(422, { errors: { branch_id: ["Nope."] } });
    assert.deepEqual(walkInFieldErrors(err), {});
  });

  test("anything but a 422 maps to no field", () => {
    assert.deepEqual(
      walkInFieldErrors(httpError(403, { errors: { id_number: ["x"] } })),
      {},
    );
    assert.deepEqual(walkInFieldErrors(httpError(500, {})), {});
    assert.deepEqual(walkInFieldErrors(new Error("offline")), {});
    assert.deepEqual(walkInFieldErrors(undefined), {});
  });

  test("a malformed errors bag maps to no field instead of throwing", () => {
    assert.deepEqual(
      walkInFieldErrors(httpError(422, { errors: { id_number: "flat" } })),
      {},
    );
    assert.deepEqual(
      walkInFieldErrors(httpError(422, { errors: { id_number: [42, ""] } })),
      {},
    );
  });
});

describe("payload", () => {
  test("is trimmed, with empty remarks sent as null", () => {
    assert.deepEqual(
      walkInPayload({
        full_name: "  Juan  ",
        mobile_number: " 0917 ",
        id_type: "UMID",
        id_number: " 1234-5678 ",
        remarks: "   ",
      }),
      {
        full_name: "Juan",
        mobile_number: "0917",
        id_type: "UMID",
        id_number: "1234-5678",
        remarks: null,
      },
    );
  });
});
