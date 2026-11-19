import test from "node:test";
import assert from "node:assert/strict";

import { branchFigureRows, branchPageFeatures, mainOfficeAction } from "./branch-page";
import type { Permission } from "@/types";

const holds =
  (...held: Permission[]) =>
  (permission: Permission) =>
    held.includes(permission);

const manager = holds("settings:view", "settings:update", "branches:manage", "branches:view_all", "loans:view");

test("with the multi-branch flag off, only the status action is added to today's page", () => {
  assert.deepEqual(branchPageFeatures(false, manager), {
    statusAction: true,
    profileFields: false,
    mainOffice: false,
    details: false,
    figures: false,
    closure: false,
  });
});

test("with the flag on, a manager with loans:view gets every section", () => {
  assert.deepEqual(branchPageFeatures(true, manager), {
    statusAction: true,
    profileFields: true,
    mainOffice: true,
    details: true,
    figures: true,
    closure: true,
  });
});

test("figures need loans:view; status, main office and closure need branches:manage plus view_all", () => {
  const viewer = holds("settings:view", "settings:update", "branches:view_all");
  assert.deepEqual(branchPageFeatures(true, viewer), {
    statusAction: false,
    profileFields: true,
    mainOffice: true,
    details: true,
    figures: false,
    closure: false,
  });
  const noViewAll = holds("settings:view", "branches:manage", "loans:view");
  assert.equal(branchPageFeatures(true, noViewAll).closure, false);
  assert.equal(branchPageFeatures(true, noViewAll).statusAction, false);
  assert.equal(branchPageFeatures(true, noViewAll).figures, true);
});

test("Make main office is offered on an active branch that isn't already the main office", () => {
  assert.deepEqual(mainOfficeAction({ status: "active", is_active: true, is_main_office: false }, manager), {
    disabledReason: null,
  });
  assert.equal(mainOfficeAction({ status: "active", is_active: true, is_main_office: true }, manager), null);
  assert.equal(mainOfficeAction({ status: "closed", is_active: false, is_main_office: false }, manager), null);
  assert.deepEqual(mainOfficeAction({ status: "suspended", is_active: false, is_main_office: false }, manager), {
    disabledReason: "Only an active branch can be the main office.",
  });
  assert.equal(
    mainOfficeAction({ status: "active", is_active: true }, holds("branches:manage", "settings:update")),
    null,
  );
});

test("figures read the server's values in words, ₱ with two decimals; zero is ₱0.00", () => {
  const rows = branchFigureRows({
    active_loans: 12,
    active_members: 9,
    total_outstanding: 152340.5,
    outstanding_principal: 120000,
    overdue_amount: 0,
    overdue_count: 0,
  });
  assert.deepEqual(rows, [
    { label: "Active loans", value: "12" },
    { label: "Members with active loans", value: "9" },
    { label: "Outstanding", value: "₱152,340.50" },
    { label: "Principal Balance", value: "₱120,000.00" },
    { label: "Past Due", value: "₱0.00" },
    { label: "Past due loans", value: "0" },
  ]);
});

test("a figure the server didn't send reads a dash, never a browser sum", () => {
  const rows = branchFigureRows({ active_loans: 3 });
  assert.equal(rows[0].value, "3");
  assert.equal(rows[2].value, "—");
  assert.equal(rows[5].value, "—");
});
