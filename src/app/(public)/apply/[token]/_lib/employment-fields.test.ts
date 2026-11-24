import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDraft } from "@/lib/loan-origination";
import type { IncomeSource } from "@/types/loan-origination";
import { askedFields, missingForSource, NOTHING_REQUIRED, productRequiredFields, rememberRequired, visibleFields } from "./employment-fields";

// The Income step shows each income source's own fields. A product's settings
// can require any field of the form (`required_fields`), and the server names
// a blank one in `missing_fields`, so a field the source would hide must still
// show when either asks for it; otherwise the applicant is stuck.

const EMPLOYER = "Enter your employer name.";

function saved(source: IncomeSource | "", productId: number | null = 7) {
  const draft = emptyDraft();
  draft.employment.income_source = source;
  draft.loan.loan_product_id = productId;
  return draft;
}

test("a farmer with a product that requires employer name: the field shows", () => {
  const shown = visibleFields("farmer", ["employment.employer_name"], {});
  assert.equal(shown.has("employer_name"), true);
  assert.equal(shown.has("other_source_description"), true);
});

test("a farmer without that requirement: it stays hidden", () => {
  const shown = visibleFields("farmer", [], {});
  assert.equal(shown.has("employer_name"), false);
  assert.deepEqual(
    [...shown].sort(),
    ["other_income_amount", "other_income_details", "other_income_frequency", "other_regular_income", "other_source_description"],
  );
});

test("a missing field from the server that the source would hide: it shows", () => {
  const shown = visibleFields("farmer", [], { "draft.employment.business_type": "Enter your business type." });
  assert.equal(shown.has("business_type"), true);
  assert.equal(shown.has("business_name"), false);
});

test("another source's optional fields stay hidden, and other sections never reach this step", () => {
  const shown = visibleFields("employed", ["personal.region"], { "draft.personal.gender": "Choose your gender." });
  assert.equal(shown.has("employment_type"), true);
  assert.equal(shown.has("business_name"), false);
  assert.equal(shown.has("region"), false);
  assert.equal(shown.has("gender"), false);
});

test("before a source is chosen, only what is asked for shows", () => {
  assert.deepEqual([...visibleFields("", [], {})], []);
  assert.deepEqual([...visibleFields("", ["employment.other_regular_income"], {})], ["other_regular_income"]);
});

test("a field asked for whatever the source is marked required", () => {
  assert.deepEqual(
    [...askedFields(["employment.employer_name"], { "draft.employment.job_title": "Enter your job title.", "draft.employment.income_source": "x" })].sort(),
    ["employer_name", "job_title"],
  );
});

test("a field the server names outside the source is the product's, and is kept once filled", () => {
  let memory = rememberRequired(NOTHING_REQUIRED, { draft: saved("farmer"), missing_fields: { "draft.employment.employer_name": EMPLOYER } });
  assert.deepEqual(memory.fields, ["employment.employer_name"]);
  memory = rememberRequired(memory, { draft: saved("farmer"), missing_fields: {} });
  assert.deepEqual(memory.fields, ["employment.employer_name"]);
});

test("the source's own rules are never taken for the product's", () => {
  const memory = rememberRequired(NOTHING_REQUIRED, {
    draft: saved("employed"),
    missing_fields: { "draft.employment.employer_name": EMPLOYER, "draft.employment.gross_monthly_income": "Enter your gross monthly income." },
  });
  assert.deepEqual(memory.fields, []);
});

test("another product starts again", () => {
  const memory = rememberRequired(NOTHING_REQUIRED, { draft: saved("farmer", 7), missing_fields: { "draft.employment.employer_name": EMPLOYER } });
  assert.deepEqual(rememberRequired(memory, { draft: saved("farmer", 8), missing_fields: {} }).fields, []);
});

test("the server's missing fields count only for the source it saved", () => {
  const missing = { "draft.employment.employer_name": EMPLOYER };
  assert.deepEqual(missingForSource({ draft: saved("employed"), missing_fields: missing }, "employed"), missing);
  assert.deepEqual(missingForSource({ draft: saved("employed"), missing_fields: missing }, "farmer"), {});
  assert.deepEqual(missingForSource(null, "farmer"), {});
});

// LO-B5 (backend #361): the state names the chosen product's required fields,
// filled or not (`required_fields`, keyed as `missing_fields` is). What was
// remembered from `missing_fields` is only for an older API that doesn't.

const REQUIRES_EMPLOYER = ["draft.employment.employer_name"];

test("a resumed session shows an already-filled required field that the source hides", () => {
  const state = { draft: saved("farmer", 7), missing_fields: {}, required_fields: REQUIRES_EMPLOYER };
  const required = productRequiredFields(state, 7, NOTHING_REQUIRED);
  assert.equal(visibleFields("farmer", required, missingForSource(state, "farmer")).has("employer_name"), true);
  assert.equal(askedFields(required, {}).has("employer_name"), true);
});

test("the server's required fields win over anything remembered", () => {
  const remembered = { productId: 7, fields: ["employment.business_type"] };
  const state = { draft: saved("farmer", 7), missing_fields: {}, required_fields: [] };
  assert.deepEqual(productRequiredFields(state, 7, remembered), []);
  assert.equal(visibleFields("farmer", productRequiredFields(state, 7, remembered), {}).has("business_type"), false);
});

test("an older API without required_fields falls back to what was remembered from missing_fields", () => {
  const remembered = { productId: 7, fields: ["employment.employer_name"] };
  assert.deepEqual(productRequiredFields({ draft: saved("farmer", 7), missing_fields: {} }, 7, remembered), ["employment.employer_name"]);
});

test("another product's required fields wait for the next save", () => {
  const state = { draft: saved("farmer", 7), missing_fields: {}, required_fields: REQUIRES_EMPLOYER };
  assert.deepEqual(productRequiredFields(state, 8, NOTHING_REQUIRED), []);
});

test("before the code step there is nothing to require", () => {
  assert.deepEqual(productRequiredFields(null, null, NOTHING_REQUIRED), []);
});

test("nothing is remembered once the server sends required_fields", () => {
  const state = { draft: saved("farmer", 7), missing_fields: { "draft.employment.employer_name": EMPLOYER }, required_fields: REQUIRES_EMPLOYER };
  assert.equal(rememberRequired(NOTHING_REQUIRED, state), NOTHING_REQUIRED);
});
