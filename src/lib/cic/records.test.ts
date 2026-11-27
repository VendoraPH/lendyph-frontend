import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicContractRecord, CicSubjectRecord } from "@/types/cic";
import { individual, installment } from "./fixtures.test-helpers";
import { buildRecordInputs, cicContext, defaultCicReferenceDate, issueCountsByRecord } from "./records";
import { validateCsdf } from "./validate";

const subject = (no: string): CicSubjectRecord => ({
  id: 1, borrower_id: 1, subject_no: no, name: "JUAN DELA CRUZ", record_type: "ID",
  values: individual({ ID5: no }), updated_at: null,
});
const contract = (no: string): CicContractRecord => ({
  id: 1, loan_id: 7, loan_number: "LN-0001", subject_no: no, borrower_name: "JUAN DELA CRUZ",
  record_type: "CI", contract_phase: "AC", values: installment({ CI5: no }), updated_at: null,
});

test("the default File Reference Date is the last day of the previous month", () => {
  assert.equal(defaultCicReferenceDate("2026-11-27"), "2026-10-31");
  assert.equal(defaultCicReferenceDate("2026-03-01"), "2026-02-28");
  assert.equal(defaultCicReferenceDate("2028-03-15"), "2028-02-29");
  assert.equal(defaultCicReferenceDate("2027-01-05"), "2026-12-31");
});

test("subjects come before contracts, each labelled for the issue list", () => {
  const inputs = buildRecordInputs([subject("M-0001")], [contract("M-0001")]);
  assert.deepEqual(inputs.map((i) => i.type), ["ID", "CI"]);
  assert.equal(inputs[0].label, "M-0001 · JUAN DELA CRUZ");
  assert.equal(inputs[1].label, "LN-0001 · JUAN DELA CRUZ");
});

test("issues are counted per record, information left out", () => {
  const settings = { provider_code: "TEST0001", is_mfi: false, contact_name: null, contact_email: null, public_key: null };
  const inputs = buildRecordInputs([subject("M-0001")], [contract("M-0002")]);
  const issues = validateCsdf(inputs, cicContext(settings, "2026-10-31"));
  const counts = issueCountsByRecord(issues);
  assert.equal(counts.get(0), undefined);
  // The contract's subject is not in the file: a warning, and its amounts round (info, not counted).
  assert.deepEqual(counts.get(1), { errors: 0, warnings: 1 });
});
