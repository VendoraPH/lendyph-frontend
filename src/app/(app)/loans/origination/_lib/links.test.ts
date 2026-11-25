import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_ADDRESS, TEST_LINK_NOTE, TEST_LOCKED_NOTE, emptyLinkInput, linkInputFrom, testSettingLocked } from "./links";
import type { ApplicationLink } from "@/types/loan-origination";

const link: ApplicationLink = {
  id: 3,
  name: "Market day",
  token: "tok",
  url: null,
  active: true,
  status: "active",
  status_label: "Active",
  is_test: true,
  can_change_test: true,
  branch_id: 2,
  branch_name: "Main",
  loan_product_ids: [5],
  loan_product_names: ["Salary Loan"],
  // A date picked as Jan 1, stored as Manila midnight and sent in UTC.
  expires_at: "2026-12-31T16:00:00.000000Z",
  display_name: null,
  contact_phone: null,
  contact_email: null,
  visits: 0,
  started: 0,
  submitted: 0,
  created_at: null,
  updated_at: null,
};

test("editing a link keeps its test mark and reads its expiry as the Manila day", () => {
  const input = linkInputFrom(link);
  assert.equal(input.is_test, true);
  assert.equal(input.expires_at, "2027-01-01");
  assert.deepEqual(input.loan_product_ids, [5]);
  // The form has no logo: links have no logo upload.
  assert.equal("display_logo_url" in input, false);
});

test("a new link is live, not a test, in the branch given", () => {
  const input = emptyLinkInput(7);
  assert.equal(input.is_test, false);
  assert.equal(input.active, true);
  assert.equal(input.branch_id, 7);
});

test("a link with no public address says why instead of offering an empty copy", () => {
  assert.match(NO_ADDRESS, /public address/);
});

test("the Test link switch locks once the server says the link has applications; a new link never locks", () => {
  assert.equal(testSettingLocked({ ...link, can_change_test: false }), true);
  assert.equal(testSettingLocked({ ...link, is_test: false, can_change_test: false }), true);
  assert.equal(testSettingLocked(link), false);
  assert.equal(testSettingLocked(null), false);
});

test("a locked Test link switch says why, in the server's words", () => {
  assert.equal(
    TEST_LOCKED_NOTE,
    "This link already has applications, so it can't be changed to or from a test link. Make a new link instead.",
  );
});

test("the test link note says who sees test codes: origination staff's own numbers, on an open test link only", () => {
  assert.match(TEST_LINK_NOTE, /only an open test link shows test codes/);
  assert.match(TEST_LINK_NOTE, /mobile number on an active staff account that works on loan origination/);
  assert.match(TEST_LINK_NOTE, /Settings → Profile/);
});
