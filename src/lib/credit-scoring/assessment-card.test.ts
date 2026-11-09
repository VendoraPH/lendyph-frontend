import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessmentBody,
  assessmentFormFrom,
  assessmentSaveErrors,
  noticeStatus,
  canSaveAssessment,
  memberDetailsHidden,
  showsCreditAssessment,
} from "./assessment-card";
import type { CreditApplicationProfile } from "@/types/credit-scoring";

const all = () => true;
const holding = (...perms: string[]) => (p: string) => perms.includes(p);

test("the card shows only with the flag on, on draft and for-approval loans, for viewers of both", () => {
  const base = { flagOn: true, status: "draft", can: all };
  assert.equal(showsCreditAssessment(base), true);
  assert.equal(showsCreditAssessment({ ...base, status: "for_review" }), true);
});

test("flag off: nothing, whatever else holds", () => {
  assert.equal(showsCreditAssessment({ flagOn: false, status: "draft", can: all }), false);
});

test("any other status: nothing", () => {
  for (const status of ["approved", "released", "current", "past_due", "ongoing", "completed", "rejected", undefined]) {
    assert.equal(showsCreditAssessment({ flagOn: true, status, can: all }), false, String(status));
  }
});

test("without credit_scoring:view or loans:view: nothing", () => {
  assert.equal(
    showsCreditAssessment({ flagOn: true, status: "draft", can: holding("loans:view") }),
    false,
  );
  assert.equal(
    showsCreditAssessment({ flagOn: true, status: "draft", can: holding("credit_scoring:view") }),
    false,
  );
});

test("saving also needs loans:update", () => {
  assert.equal(canSaveAssessment(holding("credit_scoring:view", "loans:view")), false);
  assert.equal(canSaveAssessment(holding("credit_scoring:view", "loans:view", "loans:update")), true);
});

const profile: CreditApplicationProfile = {
  other_income: "5000.50",
  business_income: null,
  household_expenses: "12000.00",
  outside_debt_payments: "0.00",
  outside_lenders_count: 2,
  employment_status: "employed",
  business_start_date: "2020-01-15",
  years_at_residence: "3.50",
  verified_references_count: 0,
  income_verification: "verified",
  notice_version: 2,
  notice_acknowledged_at: "2026-11-09T09:00:00+08:00",
  notice_acknowledged: true,
};

test("the form starts from the saved details, blanks for nulls", () => {
  const form = assessmentFormFrom(profile);
  assert.equal(form.other_income, "5000.50");
  assert.equal(form.business_income, "");
  assert.equal(form.outside_lenders_count, "2");
  assert.equal(form.verified_references_count, "0");
  assert.equal(form.income_verification, "verified");
  assert.equal(form.notice_acknowledged, true);
  assert.equal(assessmentFormFrom(null).other_income, "");
  assert.equal(assessmentFormFrom(null).notice_acknowledged, false);
});

test("the PUT body sends each changed field as typed, and an emptied one clears to null", () => {
  const loaded = assessmentFormFrom(profile);
  const form = {
    ...loaded,
    other_income: " 5000.505 ",
    household_expenses: "",
    income_verification: "" as const,
    notice_acknowledged: false,
  };
  assert.deepEqual(assessmentBody(form, loaded), {
    other_income: "5000.505",
    household_expenses: null,
    income_verification: null,
    notice_acknowledged: false,
  });
});

test("an untouched field is left out, so nothing the caller can't see is cleared", () => {
  const loaded = assessmentFormFrom({ ...profile, other_income: null, household_expenses: null, outside_debt_payments: null });
  assert.deepEqual(assessmentBody({ ...loaded, outside_lenders_count: "3" }, loaded), { outside_lenders_count: "3" });
  assert.deepEqual(assessmentBody(loaded, loaded), {});
});

test("member-detail figures are never sent while they're hidden", () => {
  const loaded = assessmentFormFrom(null);
  const typed = { ...loaded, other_income: "100.00", household_expenses: "50.00", outside_debt_payments: "1.00", business_income: "7.00" };
  assert.deepEqual(assessmentBody(typed, loaded, { memberDetailsHidden: true }), { business_income: "7.00" });
  assert.deepEqual(Object.keys(assessmentBody(typed, loaded)).sort(), [
    "business_income",
    "household_expenses",
    "other_income",
    "outside_debt_payments",
  ]);
});

test("member details are hidden without borrowers:view", () => {
  assert.equal(memberDetailsHidden(holding("loans:view")), true);
  assert.equal(memberDetailsHidden(holding("loans:view", "borrowers:view")), false);
});

test("a 422 lists every field message on the card; a 409 shows the server's reason", () => {
  const e422 = {
    response: {
      status: 422,
      data: {
        message: "x",
        errors: {
          loan: ["Only a draft or for-approval loan's credit assessment can be saved."],
          other_income: ["The other income field must not be greater than 9999999999.99."],
        },
      },
    },
  };
  assert.deepEqual(assessmentSaveErrors(e422), [
    "Only a draft or for-approval loan's credit assessment can be saved.",
    "The other income field must not be greater than 9999999999.99.",
  ]);
  const e409 = { response: { status: 409, data: { message: "The member is being scored right now. Try again in a moment." } } };
  assert.deepEqual(assessmentSaveErrors(e409), ["The member is being scored right now. Try again in a moment."]);
});

const olderConsent: CreditApplicationProfile = {
  ...profile,
  notice_version: 1,
  notice_acknowledged_at: "2026-10-01T09:00:00+08:00",
  notice_acknowledged: false,
};

test("a save with the notice box untouched leaves the acknowledgement out, so earlier consent stays", () => {
  const loaded = assessmentFormFrom(olderConsent);
  assert.equal(loaded.notice_acknowledged, false);
  const body = assessmentBody({ ...loaded, other_income: "6000.00" }, loaded);
  assert.equal("notice_acknowledged" in body, false);
  assert.equal(body.other_income, "6000.00");
  assert.equal("notice_acknowledged" in assessmentBody(assessmentFormFrom(null), assessmentFormFrom(null)), false);
});

test("ticking or clearing the box sends the change", () => {
  const unticked = assessmentFormFrom(olderConsent);
  assert.equal(assessmentBody({ ...unticked, notice_acknowledged: true }, unticked).notice_acknowledged, true);
  const ticked = assessmentFormFrom(profile);
  assert.equal(assessmentBody({ ...ticked, notice_acknowledged: false }, ticked).notice_acknowledged, false);
});

test("the notice status names an earlier version's acknowledgement", () => {
  assert.deepEqual(noticeStatus(olderConsent), { kind: "earlier", version: "1", at: "2026-10-01T09:00:00+08:00" });
  assert.deepEqual(noticeStatus(profile), { kind: "current", version: "2", at: "2026-11-09T09:00:00+08:00" });
  assert.deepEqual(noticeStatus(null), { kind: "none" });
  assert.deepEqual(noticeStatus({ ...profile, notice_acknowledged: false, notice_version: null, notice_acknowledged_at: null }), { kind: "none" });
});
