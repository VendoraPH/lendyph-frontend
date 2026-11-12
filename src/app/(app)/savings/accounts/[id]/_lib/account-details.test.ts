import { test } from "node:test";
import assert from "node:assert/strict";
import { accountDetailItems, postedByText } from "./account-details";

test("the account's opening details read as the server sent them", () => {
  assert.deepEqual(
    accountDetailItems({
      account_officer: { id: 3, name: "Kevin Officer" },
      source_of_funds: "other",
      source_of_funds_label: "Other: Rental income",
      beneficiary: { name: "Maria Cruz", relationship: "Daughter", contact_number: "0917 000 0000" },
    }),
    [
      { label: "Account officer", value: "Kevin Officer" },
      { label: "Source of funds", value: "Other: Rental income" },
      { label: "Beneficiary", value: "Maria Cruz (Daughter)" },
      { label: "Beneficiary contact", value: "0917 000 0000" },
    ],
  );
});

test("a contact the server withholds reads a dash, and missing details read a dash, never a raw key", () => {
  const items = accountDetailItems({
    account_officer: null,
    source_of_funds: "salary",
    source_of_funds_label: null,
    beneficiary: { name: "Maria Cruz", relationship: null, contact_number: null },
  });
  assert.deepEqual(
    items.map((i) => i.value),
    ["—", "—", "Maria Cruz", "—"],
  );
  assert.deepEqual(accountDetailItems({}).map((i) => i.value), ["—", "—", "—", "—"]);
});

test("a line posted through an approval names its maker as the requester", () => {
  assert.deepEqual(postedByText({ created_by: { id: 1, name: "Super Admin" }, approval_id: 12 }), {
    primary: "Requested by Super Admin",
    secondary: "Approved through request #12",
  });
  assert.deepEqual(postedByText({ created_by: { id: 1, name: "Teller One" }, approval_id: null }), {
    primary: "Teller One",
    secondary: null,
  });
  assert.deepEqual(postedByText({ created_by: null, approval_id: null }), { primary: "System", secondary: null });
});

// Gap round B9: posted lines name the checker who approved them.
test("a line posted through an approval names its requester and its checker, both when there were two", () => {
  const A = { id: 1, name: "Ana Teller" };
  const J = { id: 2, name: "Jose Checker" };
  const K = { id: 3, name: "Kevin Manager" };
  assert.deepEqual(postedByText({ created_by: A, approval_id: 12, approved_by: K, first_checker: null }), {
    primary: "Requested by Ana Teller",
    secondary: "Approved by Kevin Manager",
  });
  assert.deepEqual(postedByText({ created_by: A, approval_id: 13, approved_by: K, first_checker: J }), {
    primary: "Requested by Ana Teller",
    secondary: "Approved by Jose Checker and Kevin Manager",
  });
  // An older server that names no checker still points to the request.
  assert.deepEqual(postedByText({ created_by: A, approval_id: 14 }), {
    primary: "Requested by Ana Teller",
    secondary: "Approved through request #14",
  });
});
