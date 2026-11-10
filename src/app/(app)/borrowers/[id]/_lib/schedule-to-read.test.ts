import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Loan } from "@/types";
import { scheduleToRead } from "./schedule-to-read";

const loan = (id: number, status: string) => ({ id, status }) as Pick<Loan, "id" | "status">;

describe("scheduleToRead", () => {
  const loans = [loan(1, "ongoing"), loan(4, "approved"), loan(5, "draft"), loan(6, "completed")];

  test("a released loan's schedule is read as its row opens", () => {
    assert.equal(scheduleToRead(loans, 1, {}), 1);
    assert.equal(scheduleToRead(loans, 6, {}), 6);
  });

  test("a loan not yet released has no saved schedule to read", () => {
    assert.equal(scheduleToRead(loans, 4, {}), null);
    assert.equal(scheduleToRead(loans, 5, {}), null);
  });

  test("no open row, an unknown loan, or a schedule already read reads nothing", () => {
    assert.equal(scheduleToRead(loans, null, {}), null);
    assert.equal(scheduleToRead(loans, 99, {}), null);
    assert.equal(scheduleToRead(loans, 1, { 1: [] }), null);
  });

  test("the Loans tab reads schedules through it", () => {
    const tab = readFileSync(
      join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/loans-tab.tsx"),
      "utf8",
    );
    assert.ok(tab.includes("scheduleToRead(loans, expandedLoan, schedules)"));
  });
});
