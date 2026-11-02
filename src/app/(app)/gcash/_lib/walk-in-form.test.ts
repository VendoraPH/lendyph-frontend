import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  ID_NUMBER_NEEDS_TYPE,
  ID_NUMBER_NOT_BLANK,
  ID_TYPE_NEEDS_NUMBER,
  WALK_IN_MAX_LENGTH,
  acknowledgedWalkInPayload,
  hasRequiredWalkInFields,
  possibleDuplicateWarning,
  validateWalkInForm,
  walkInFieldErrors,
  walkInFormFrom,
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

describe("optional ID", () => {
  const NO_ID: WalkInFormState = { ...FILLED, id_type: "", id_number: "" };

  test("a walk-in without an ID sends both ID fields as null", () => {
    const payload = walkInPayload({ ...NO_ID, id_number: "   " });
    assert.equal(payload.id_type, null);
    assert.equal(payload.id_number, null);
  });

  test("name and mobile number are all that is required", () => {
    assert.equal(hasRequiredWalkInFields(walkInPayload(NO_ID)), true);
    assert.equal(
      hasRequiredWalkInFields(walkInPayload({ ...NO_ID, full_name: "  " })),
      false,
    );
    assert.equal(
      hasRequiredWalkInFields(walkInPayload({ ...NO_ID, mobile_number: "" })),
      false,
    );
  });

  test("no ID at all passes validation", () => {
    assert.deepEqual(validateWalkInForm(NO_ID), {});
  });

  test("both ID fields filled passes validation", () => {
    assert.deepEqual(validateWalkInForm(FILLED), {});
  });

  test("an ID type without a number asks for the number", () => {
    assert.deepEqual(validateWalkInForm({ ...NO_ID, id_type: "UMID" }), {
      id_number: ID_TYPE_NEEDS_NUMBER,
    });
  });

  test("an ID number without a type asks for the type", () => {
    assert.deepEqual(validateWalkInForm({ ...NO_ID, id_number: "1234" }), {
      id_type: ID_NUMBER_NEEDS_TYPE,
    });
  });

  test("a dash-only number without a type gets both messages", () => {
    assert.deepEqual(validateWalkInForm({ ...NO_ID, id_number: "---" }), {
      id_type: ID_NUMBER_NEEDS_TYPE,
      id_number: ID_NUMBER_NOT_BLANK,
    });
  });

  test("uses the backend's own both-or-neither wording", () => {
    assert.equal(
      ID_TYPE_NEEDS_NUMBER,
      "Enter the ID number too, or leave both ID fields blank.",
    );
    assert.equal(
      ID_NUMBER_NEEDS_TYPE,
      "Enter the ID type too, or leave both ID fields blank.",
    );
  });

  test("a saved walk-in without an ID edits as empty fields, not \"null\"", () => {
    const form = walkInFormFrom({
      id: 1,
      full_name: "Juan",
      mobile_number: "0917",
      id_type: null,
      id_number: null,
      remarks: null,
      created_at: "2026-11-02T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
    });
    assert.equal(form.id_type, "");
    assert.equal(form.id_number, "");
  });
});

describe("possible duplicate warning", () => {
  const WARNING =
    "A walk-in named Carla Dizon with the same mobile number is already registered. Check that this is a different customer, or save anyway.";

  test("maps errors.possible_duplicate to its message", () => {
    const err = httpError(422, {
      message: WARNING,
      errors: { possible_duplicate: [WARNING] },
    });
    assert.equal(possibleDuplicateWarning(err), WARNING);
  });

  test("is not a field error, so it never lands on an input", () => {
    const err = httpError(422, { errors: { possible_duplicate: [WARNING] } });
    assert.deepEqual(walkInFieldErrors(err), {});
  });

  test("anything else is not a warning", () => {
    assert.equal(
      possibleDuplicateWarning(httpError(422, { errors: { id_number: [DUPLICATE] } })),
      null,
    );
    assert.equal(
      possibleDuplicateWarning(httpError(409, { errors: { possible_duplicate: [WARNING] } })),
      null,
    );
    assert.equal(
      possibleDuplicateWarning(httpError(422, { errors: { possible_duplicate: "flat" } })),
      null,
    );
    assert.equal(possibleDuplicateWarning(new Error("offline")), null);
    assert.equal(possibleDuplicateWarning(undefined), null);
  });

  test("Save anyway resends the same payload with the acknowledgement", () => {
    const payload = walkInPayload({ ...FILLED, id_type: "", id_number: "" });
    assert.deepEqual(acknowledgedWalkInPayload(payload), {
      ...payload,
      acknowledge_possible_duplicate: true,
    });
    assert.equal(payload.acknowledge_possible_duplicate, undefined);
  });
});
