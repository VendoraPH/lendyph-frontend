import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NUMBER_MAX,
  canEditMembership,
  hasMembership,
  memberTypeLabel,
  membershipDraft,
  membershipFailure,
  membershipLength,
  membershipRequest,
  membershipRows,
  withMembership,
  type MembershipSource,
} from "./member-membership";

const TODAY = "2026-11-24";

function member(overrides: Partial<MembershipSource> = {}): MembershipSource {
  return {
    status: "active",
    borrower_code: "BRW-000123",
    membership_date: "2019-03-01",
    member_type: "regular",
    membership_number: "BRW-000123",
    membership_ended_on: null,
    ...overrides,
  };
}

function refusal(status: number, errors?: Record<string, string[]>, message?: string) {
  return { isAxiosError: true, response: { status, data: { message, ...(errors ? { errors } : {}) } } };
}

/** A `can()` that answers yes only for the keys given. */
function holds(...keys: string[]) {
  return (permission: string) => keys.includes(permission);
}

// ── Who has a membership, and who edits it ──

test("a member has membership details; a pending or rejected registration has none", () => {
  for (const status of ["active", "inactive", "blacklisted", "withdrawn", "deceased"]) {
    assert.equal(hasMembership({ status }), true, status);
  }
  assert.equal(hasMembership({ status: "pending" }), false);
  assert.equal(hasMembership({ status: "rejected" }), false);
});

test("Edit is offered to borrowers:update holders, for members only", () => {
  assert.equal(canEditMembership(holds("borrowers:view", "borrowers:update"), member()), true);
  assert.equal(canEditMembership(holds("borrowers:view"), member()), false);
  assert.equal(canEditMembership(holds("borrowers:update"), member({ status: "pending" })), false);
  // A former member's details can still be corrected.
  assert.equal(canEditMembership(holds("borrowers:update"), member({ status: "withdrawn" })), true);
});

// ── What the card shows ──

test("the member type reads in words, the stored default being Regular", () => {
  assert.equal(memberTypeLabel("regular"), "Regular");
  assert.equal(memberTypeLabel("associate"), "Associate");
  assert.equal(memberTypeLabel(null), "Regular");
  assert.equal(memberTypeLabel("honorary"), "Honorary");
});

test("Member since is how long the membership has lasted, in whole months", () => {
  assert.equal(membershipLength("2019-03-01", TODAY), "7 years, 8 months");
  assert.equal(membershipLength("2025-11-24", TODAY), "1 year");
  assert.equal(membershipLength("2025-11-25", TODAY), "11 months");
  assert.equal(membershipLength("2026-10-24", TODAY), "1 month");
  assert.equal(membershipLength("2026-11-01", TODAY), "Less than a month");
  assert.equal(membershipLength("2024-10-24", TODAY), "2 years, 1 month");
  assert.equal(membershipLength(null, TODAY), null);
  assert.equal(membershipLength("", TODAY), null);
  assert.equal(membershipLength("not a date", TODAY), null);
});

test("the card: date, type, number and Member since, with a dash for what's missing", () => {
  assert.deepEqual(membershipRows(member(), TODAY), [
    { label: "Membership Date", value: "Mar 1, 2019" },
    { label: "Member Type", value: "Regular" },
    { label: "Membership Number", value: "BRW-000123" },
    { label: "Member since", value: "7 years, 8 months" },
  ]);
  assert.deepEqual(
    membershipRows(member({ membership_date: null, membership_number: null, member_type: "associate" }), TODAY).map((r) => r.value),
    ["—", "Associate", "—", "—"],
  );
});

test("a former member's card says when and how the membership ended, and counts up to that day", () => {
  const rows = membershipRows(member({ status: "withdrawn", membership_ended_on: "2026-10-01" }), TODAY);
  assert.deepEqual(rows.at(-2), { label: "Member since", value: "7 years, 7 months" });
  assert.deepEqual(rows.at(-1), { label: "Membership Ended", value: "Oct 1, 2026 (Withdrawn)" });
  assert.deepEqual(
    membershipRows(member({ status: "deceased", membership_ended_on: "2026-10-01" }), TODAY).at(-1),
    { label: "Membership Ended", value: "Oct 1, 2026 (Deceased)" },
  );
});

// ── The edit ──

test("the dialog starts from the member's own details", () => {
  assert.deepEqual(membershipDraft(member()), {
    membership_date: "2019-03-01",
    member_type: "regular",
    membership_number: "BRW-000123",
  });
  assert.deepEqual(membershipDraft(member({ membership_date: null, member_type: null, membership_number: null })), {
    membership_date: "",
    member_type: "regular",
    membership_number: "",
  });
});

test("only what changed is sent, the number as members sign in with it", () => {
  const request = membershipRequest(
    { membership_date: "2018-07-15", member_type: "associate", membership_number: " mem 0042 " },
    member(),
    TODAY,
  );
  assert.deepEqual(request, {
    ok: true,
    changed: true,
    body: { membership_date: "2018-07-15", member_type: "associate", membership_number: "MEM0042" },
  });

  const typeOnly = membershipRequest({ ...membershipDraft(member()), member_type: "associate" }, member(), TODAY);
  assert.deepEqual(typeOnly, { ok: true, changed: true, body: { member_type: "associate" } });
});

test("an unchanged dialog sends nothing, the number compared as stored", () => {
  assert.deepEqual(membershipRequest(membershipDraft(member()), member(), TODAY), { ok: true, changed: false, body: {} });
  assert.deepEqual(
    membershipRequest({ ...membershipDraft(member()), membership_number: "brw-000123" }, member(), TODAY),
    { ok: true, changed: false, body: {} },
  );
});

test("a cleared number goes back to the member code; a missing one left blank stays unsent", () => {
  const numbered = member({ membership_number: "MEM-0042" });
  assert.deepEqual(membershipRequest({ ...membershipDraft(numbered), membership_number: "  " }, numbered, TODAY), {
    ok: true,
    changed: true,
    body: { membership_number: null },
  });
  // Already the member code: clearing it changes nothing.
  assert.deepEqual(membershipRequest({ ...membershipDraft(member()), membership_number: "" }, member(), TODAY), {
    ok: true,
    changed: false,
    body: {},
  });
  const unnumbered = member({ membership_date: null, membership_number: null });
  assert.deepEqual(membershipRequest(membershipDraft(unnumbered), unnumbered, TODAY), { ok: true, changed: false, body: {} });
});

test("the date is year-month-day, not after today, and can't be cleared once set", () => {
  const draft = membershipDraft(member());
  const dateError = (date: string, source = member()) => {
    const request = membershipRequest({ ...draft, membership_date: date }, source, TODAY);
    return request.ok ? null : request.errors.membership_date;
  };
  assert.equal(dateError("2026-11-25"), "The membership date can't be in the future.");
  assert.equal(dateError("2026-11-24"), null);
  assert.equal(dateError("2019/03/01"), "The membership date must be a date written as year-month-day, such as 2026-01-15.");
  assert.equal(dateError("2019-02-30"), "The membership date must be a date written as year-month-day, such as 2026-01-15.");
  assert.equal(dateError(""), "Enter the membership date. It can be changed but not cleared.");
  // A member with no date yet may leave it blank.
  assert.equal(dateError("", member({ membership_date: null })), null);
});

test("a former member's date can't fall after the day the membership ended", () => {
  const withdrawn = member({ status: "withdrawn", membership_ended_on: "2026-10-01" });
  const request = membershipRequest({ ...membershipDraft(withdrawn), membership_date: "2026-10-02" }, withdrawn, TODAY);
  assert.deepEqual(request, {
    ok: false,
    errors: { membership_date: "The membership date can't be after the day the membership ended (Oct 1, 2026)." },
  });
  assert.equal(membershipRequest({ ...membershipDraft(withdrawn), membership_date: "2026-10-01" }, withdrawn, TODAY).ok, true);
});

test("the type must be one of the two, and the number fit its 30 characters", () => {
  const draft = membershipDraft(member());
  const typeRequest = membershipRequest({ ...draft, member_type: "" }, member(), TODAY);
  assert.deepEqual(typeRequest, { ok: false, errors: { member_type: "Choose Regular or Associate for the member type." } });

  const long = membershipRequest({ ...draft, membership_number: "7".repeat(NUMBER_MAX + 1) }, member(), TODAY);
  assert.deepEqual(long, { ok: false, errors: { membership_number: "The membership number can be at most 30 characters." } });
  // Spaces are dropped before it is measured.
  assert.equal(membershipRequest({ ...draft, membership_number: `${"7".repeat(NUMBER_MAX)} ` }, member(), TODAY).ok, true);
});

// ── A refused save ──

test("the server's refusals show under their own fields, in its words", () => {
  const failure = membershipFailure(
    refusal(422, {
      membership_number: ["Membership number MEM-0042 already belongs to another member. Each member's number is their own."],
      membership_date: ["The membership date can't be in the future."],
    }),
  );
  assert.deepEqual(failure, {
    fields: {
      membership_number: "Membership number MEM-0042 already belongs to another member. Each member's number is their own.",
      membership_date: "The membership date can't be in the future.",
    },
    general: null,
    outOfReach: false,
  });
});

test("a refusal about the member itself shows above the buttons", () => {
  const words = "Only a member has membership details. Approve the registration first; approving sets them.";
  assert.deepEqual(membershipFailure(refusal(422, { status: [words] }, words)), {
    fields: {},
    general: words,
    outOfReach: false,
  });
});

test("a member outside the caller's branches now can't be saved again; other failures read in words", () => {
  const gone = membershipFailure(refusal(404, undefined, "No query results for model [App\\Models\\Borrower] 7"));
  assert.equal(gone.outOfReach, true);
  assert.match(gone.general ?? "", /outside your branches/);
  assert.doesNotMatch(gone.general ?? "", /App\\Models|query/);

  const denied = membershipFailure(refusal(403, undefined, "This action is unauthorized."));
  assert.equal(denied.outOfReach, false);
  assert.ok((denied.general ?? "").length > 0);
  assert.deepEqual(denied.fields, {});
});

test("the saved details replace only the membership fields of the member on the page", () => {
  const page = { ...member(), id: 7, full_name: "Ana Cruz", photo_url: "signed" };
  const saved = { ...member(), id: 7, full_name: "Ana Cruz", membership_date: "2018-07-15", member_type: "associate", membership_number: "MEM0042" };
  assert.deepEqual(withMembership(page, saved), {
    ...page,
    membership_date: "2018-07-15",
    member_type: "associate",
    membership_number: "MEM0042",
  });
});
