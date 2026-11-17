/**
 * The small picture beside each heading of the Reports and Documents catalogs.
 *
 * WHAT THIS PROVES: every report category and every printable subject has a
 * module picture, the agreed one for that section, no two neighbouring
 * sections repeat, and each picture is a filled slot.
 * WHAT IT DOES NOT PROVE: how the heading draws it, or that the page still fits
 * at 1366x768 (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_ILLUSTRATION, CATEGORY_META } from "@/app/(app)/reports/_lib/types";
import { SUBJECT_ILLUSTRATION, SUBJECT_META } from "@/lib/printables/types";
import { ILLUSTRATIONS, MODULE_ILLUSTRATION_NAMES } from "./illustrations";

test("each report category shows its module's picture", () => {
  assert.deepEqual(Object.keys(CATEGORY_ILLUSTRATION).sort(), Object.keys(CATEGORY_META).sort());
  assert.deepEqual(CATEGORY_ILLUSTRATION, {
    operations: "emptyPayments",
    portfolio: "emptyCollaterals",
    member: "emptyMembers",
    disbursement: "emptyLoans",
    financial: "emptyLedger",
    performance: "emptyShareCapital",
    savings: "emptySavings",
  });
});

test("each printable subject shows its module's picture", () => {
  assert.deepEqual(Object.keys(SUBJECT_ILLUSTRATION).sort(), Object.keys(SUBJECT_META).sort());
  assert.deepEqual(SUBJECT_ILLUSTRATION, {
    loan: "emptyLoans",
    borrower: "emptyMembers",
    repayment: "emptyPayments",
    savings_account: "emptySavings",
    savings_withdrawal: "emptyWallet",
    time_deposit: "emptyShareCapital",
  });
});

test("no two neighbouring catalog sections share a picture", () => {
  const reports = Object.keys(CATEGORY_META).map((c) => CATEGORY_ILLUSTRATION[c as keyof typeof CATEGORY_ILLUSTRATION]);
  const subjects = ["loan", "borrower", "repayment", "savings_account", "savings_withdrawal", "time_deposit"] as const;
  const printables = subjects.map((s) => SUBJECT_ILLUSTRATION[s]);
  for (const list of [reports, printables]) {
    for (let i = 1; i < list.length; i++) assert.notEqual(list[i], list[i - 1], `${list[i - 1]} repeats`);
  }
});

test("every catalog picture is a filled module slot", () => {
  for (const name of [...Object.values(CATEGORY_ILLUSTRATION), ...Object.values(SUBJECT_ILLUSTRATION)]) {
    assert.ok((MODULE_ILLUSTRATION_NAMES as readonly string[]).includes(name), name);
    assert.ok(ILLUSTRATIONS[name], `${name} has no picture`);
  }
});
