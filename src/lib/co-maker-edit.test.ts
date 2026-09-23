import test from "node:test";
import assert from "node:assert/strict";

import {
  coMakerDetailsProblems,
  coMakerToForm,
  coMakerUpdatePayload,
  mergeFreshIntoForm,
  type CoMakerFormData,
} from "./co-maker-edit";
import type { UpdateCoMakerData } from "@/services/co-maker.service";
import type { CoMaker } from "@/types";

// A co-maker exactly as GET /co-makers/{id} returns it (CoMakerResource): the
// name in parts, `null` for the parts not on file, `monthly_income` as the
// string Laravel's decimal:2 cast produces, and none of the fields the form
// shows but the API has no column for.
const stored = {
  id: 12,
  co_maker_code: "CMK-000012",
  borrower_id: 5,
  first_name: "Juan",
  middle_name: null,
  last_name: "Dela Cruz",
  suffix: null,
  full_name: "Juan Dela Cruz",
  address: "Purok 3, Brgy. San Isidro",
  contact_number: "09171234567",
  occupation: "Teacher",
  employer: "DepEd",
  monthly_income: "25000.00",
  relationship_to_borrower: "sibling",
  status: "active",
  documents: [],
  created_at: "2026-09-01T02:00:00.000000Z",
  updated_at: "2026-09-01T02:00:00.000000Z",
} as unknown as CoMaker;

const withMiddleAndSuffix = {
  ...stored,
  middle_name: "Santos",
  suffix: "Jr.",
  full_name: "Juan Santos Dela Cruz Jr.",
} as unknown as CoMaker;

const untouched = coMakerToForm(stored);

// UpdateCoMakerRequest::rules(), key for key. The controller writes
// `validated()`, so any other key is dropped without a word.
const API_KEYS = [
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "address",
  "contact_number",
  "occupation",
  "employer",
  "monthly_income",
  "relationship_to_borrower",
  "status",
];

const CLEARABLE = [
  "middle_name",
  "suffix",
  "address",
  "occupation",
  "employer",
  "monthly_income",
] as const satisfies readonly (keyof UpdateCoMakerData)[];

test("edited name, phone and relationship are sent under the API's own keys", () => {
  // Against the old inline payload this failed on its first assertion: the
  // `...fresh` spread re-sent the stored "Juan", and the edit travelled under
  // `full_name` / `phone` / `relationship`, which the API never reads.
  const payload = coMakerUpdatePayload({
    ...untouched,
    first_name: "Juanito",
    middle_name: "Reyes",
    last_name: "Dela Cruz-Reyes",
    suffix: "III",
    phone: "09998887777",
    relationship: "spouse",
  });

  assert.equal(payload.first_name, "Juanito");
  assert.equal(payload.middle_name, "Reyes");
  assert.equal(payload.last_name, "Dela Cruz-Reyes");
  assert.equal(payload.suffix, "III");
  assert.equal(payload.contact_number, "09998887777");
  assert.equal(payload.relationship_to_borrower, "spouse");
});

test("cleared optional fields are sent as null, and the null survives JSON", () => {
  // Also failed against the old payload: an emptied address, occupation,
  // employer or income became `undefined`, which JSON.stringify drops, and a
  // middle name or suffix was only ever re-sent from the stored co-maker.
  const payload = coMakerUpdatePayload({
    ...coMakerToForm(withMiddleAndSuffix),
    middle_name: "",
    suffix: "",
    address: "",
    occupation: "",
    employer: "",
    monthly_income: "",
  });
  // What actually goes over the wire.
  const wire = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

  for (const key of CLEARABLE) {
    assert.equal(payload[key], null, `${key} should be sent as null`);
    assert.ok(key in wire, `${key} must still be on the wire — an undefined key is not`);
    assert.equal(wire[key], null);
  }
});

test("a field of spaces is a cleared field, not a string of spaces", () => {
  const payload = coMakerUpdatePayload({
    ...coMakerToForm(withMiddleAndSuffix),
    middle_name: "   ",
    suffix: " ",
    address: "\n  ",
    occupation: "  ",
    employer: "\t",
    // Number("   ") is 0: untrimmed, a blank income would be saved as zero.
    monthly_income: "   ",
  });

  for (const key of CLEARABLE) {
    assert.equal(payload[key], null, `${key} should be null`);
  }
});

test("monthly income: blank is null, zero is zero", () => {
  assert.equal(coMakerUpdatePayload({ ...untouched, monthly_income: "" }).monthly_income, null);
  assert.equal(coMakerUpdatePayload({ ...untouched, monthly_income: "0" }).monthly_income, 0);
  assert.equal(coMakerUpdatePayload({ ...untouched, monthly_income: "18500.50" }).monthly_income, 18500.5);
  // The API's own decimal string, as an untouched form holds it.
  assert.equal(coMakerUpdatePayload(untouched).monthly_income, 25000);
});

test("names and phone are trimmed, and names stay strings", () => {
  const payload = coMakerUpdatePayload({
    ...untouched,
    first_name: "  Juanito ",
    last_name: " Reyes  ",
    phone: " 09998887777 ",
  });
  assert.equal(payload.first_name, "Juanito");
  assert.equal(payload.last_name, "Reyes");
  assert.equal(payload.contact_number, "09998887777");
});

test("the payload carries the API's columns and nothing the form only displays", () => {
  // The linked loan has no column on `co_makers` and no rule on the request.
  // Picked or not, it must not be sent: a key the API does not validate is
  // discarded while the response still says 200. (The valid ID is not on this
  // form at all any more — it has its own endpoint.)
  const payload = coMakerUpdatePayload({ ...untouched, loan_id: 42 });

  assert.deepEqual(Object.keys(payload).sort(), [
    "address",
    "contact_number",
    "employer",
    "first_name",
    "last_name",
    "middle_name",
    "monthly_income",
    "occupation",
    "relationship_to_borrower",
    "suffix",
  ]);
  for (const key of Object.keys(payload)) {
    assert.ok(API_KEYS.includes(key), `${key} is not a key UpdateCoMakerRequest validates`);
  }
});

test("an untouched form writes back exactly what is stored", () => {
  // The round trip every Save makes. It guards coMakerToForm as much as the
  // payload: reading a null middle name with `??` re-derived one from
  // full_name — "Dela", out of "Juan Dela Cruz" — and Save would write it.
  assert.deepEqual(coMakerUpdatePayload(coMakerToForm(stored)), {
    first_name: "Juan",
    middle_name: null,
    last_name: "Dela Cruz",
    suffix: null,
    relationship_to_borrower: "sibling",
    contact_number: "09171234567",
    address: "Purok 3, Brgy. San Isidro",
    occupation: "Teacher",
    employer: "DepEd",
    monthly_income: 25000,
  });
});

test("a co-maker with nothing optional on file round-trips as nulls", () => {
  const sparse = {
    ...stored,
    address: null,
    contact_number: null,
    occupation: null,
    employer: null,
    monthly_income: null,
    relationship_to_borrower: null,
  } as unknown as CoMaker;

  const form = coMakerToForm(sparse);
  assert.equal(form.monthly_income, "");
  assert.equal(form.phone, "");
  assert.equal(form.relationship, "");

  assert.deepEqual(coMakerUpdatePayload(form), {
    first_name: "Juan",
    middle_name: null,
    last_name: "Dela Cruz",
    suffix: null,
    relationship_to_borrower: null,
    contact_number: null,
    address: null,
    occupation: null,
    employer: null,
    monthly_income: null,
  });
});

test("a null middle name opens as no middle name, not a slice of full_name", () => {
  assert.equal(coMakerToForm(stored).middle_name, "");

  const suffixed = {
    ...stored,
    last_name: "Santos",
    suffix: "Jr.",
    full_name: "Juan Santos Jr.",
  } as unknown as CoMaker;
  assert.equal(coMakerToForm(suffixed).middle_name, "");

  const twoWordFirstName = {
    ...stored,
    first_name: "Maria Clara",
    last_name: "Santos",
    full_name: "Maria Clara Santos",
  } as unknown as CoMaker;
  assert.equal(coMakerToForm(twoWordFirstName).first_name, "Maria Clara");
  assert.equal(coMakerToForm(twoWordFirstName).middle_name, "");
});

test("a record carrying no name parts still has its full_name split", () => {
  // The older shape the fallback was written for: only `full_name`.
  const legacy = { id: 3, full_name: "Maria Clara Santos" } as CoMaker;
  const form = coMakerToForm(legacy);
  assert.deepEqual(
    [form.first_name, form.middle_name, form.last_name],
    ["Maria", "Clara", "Santos"]
  );
});

test("a fresh copy fills the fields nobody touched and keeps what was typed", () => {
  // The dialog opens on the list snapshot, then re-fetches. Someone else has
  // since changed the occupation; meanwhile this person typed a new last name.
  const snapshot = coMakerToForm(stored);
  const typed: CoMakerFormData = { ...snapshot, last_name: "Dela Cruz-Reyes" };
  const fresh = coMakerToForm({ ...stored, occupation: "Principal" } as unknown as CoMaker);

  const merged = mergeFreshIntoForm(fresh, typed, new Set(["last_name"]));

  assert.equal(merged.last_name, "Dela Cruz-Reyes", "what was typed survives");
  assert.equal(merged.occupation, "Principal", "an untouched field takes the fresh value");
});

test("with nothing touched, the fresh copy is taken whole", () => {
  const fresh = coMakerToForm({ ...stored, occupation: "Principal" } as unknown as CoMaker);
  assert.deepEqual(mergeFreshIntoForm(fresh, untouched, new Set()), fresh);
});

test("a field cleared on purpose stays cleared when the fresh copy lands", () => {
  // Emptying a field is typing too: the fresh copy must not quietly put the
  // old value back, or the save would write it again.
  const cleared: CoMakerFormData = { ...untouched, employer: "" };
  const merged = mergeFreshIntoForm(coMakerToForm(stored), cleared, new Set(["employer"]));
  assert.equal(merged.employer, "");
});

test("a complete form has nothing missing", () => {
  assert.deepEqual(coMakerDetailsProblems(untouched), {});
});

test("each required field is named when it is missing", () => {
  const problems = coMakerDetailsProblems({
    ...untouched,
    first_name: "",
    last_name: "",
    relationship: "",
    phone: "",
  });
  assert.deepEqual(Object.keys(problems).sort(), ["first_name", "last_name", "phone", "relationship"]);
});

test("names and a phone of only spaces count as missing", () => {
  // `required` on the inputs lets these through; the save used to stop on them
  // without a word.
  const problems = coMakerDetailsProblems({ ...untouched, first_name: "  ", phone: " " });
  assert.deepEqual(Object.keys(problems).sort(), ["first_name", "phone"]);
});
