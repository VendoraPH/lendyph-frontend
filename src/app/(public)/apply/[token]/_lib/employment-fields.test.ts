import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDraft } from "@/lib/loan-origination";
import type { IncomeSource } from "@/types/loan-origination";
import { askedFields, missingForSource, NOTHING_REQUIRED, rememberRequired, visibleFields } from "./employment-fields";

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
