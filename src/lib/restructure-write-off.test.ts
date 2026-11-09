/**
 * What a restructured loan shows for what the restructure didn't carry: two
 * labelled server figures, never one unlabelled "Written off".
 *
 * WHAT THIS PROVES: the approved forgiveness is the closed loan's
 * `write_off_amount`; the principal written off in the books is the new
 * loan's `restructure_written_off_principal` (from `restructured_into`); each
 * is shown as the server sent it, ₱0.00 for zero and a dash when missing; and
 * the loan page's two places pin both labels.
 * WHAT IT DOES NOT PROVE: the figures themselves (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Loan, RestructuredIntoLoan } from "@/types/loan";
import { restructureWriteOffFigures, writeOffFigureText } from "./restructure-write-off";

function successor(extra: Partial<RestructuredIntoLoan>): RestructuredIntoLoan {
  return { id: 12, application_number: "APP-12", loan_account_number: "LN-12", status: "released", principal_amount: 40000, start_date: null, ...extra };
}

test("the closed loan shows the approved forgiveness and the principal written off in the books, labelled", () => {
  const loan: Pick<Loan, "write_off_amount" | "restructured_into"> = {
    write_off_amount: 9500.01,
    restructured_into: [successor({ restructure_written_off_principal: 5000.01 })],
  };
  assert.deepEqual(restructureWriteOffFigures(loan), [
    { label: "Forgiven (approved)", amount: 9500.01 },
    { label: "Principal written off in the books", amount: 5000.01 },
  ]);
});

test("the books figure is the released successor's, not a rejected or voided application's", () => {
  const loan: Pick<Loan, "write_off_amount" | "restructured_into"> = {
    write_off_amount: 100,
    restructured_into: [
      successor({ id: 11, status: "rejected", restructure_written_off_principal: 999 }),
      successor({ restructure_written_off_principal: 0 }),
    ],
  };
  assert.equal(restructureWriteOffFigures(loan)[1].amount, 0);
});

test("a figure sent as a 2-decimal string reads the same", () => {
  assert.deepEqual(
    restructureWriteOffFigures({ write_off_amount: "9500.01", restructured_into: [{ status: "released", restructure_written_off_principal: "5000.01" }] }).map((f) => f.amount),
    [9500.01, 5000.01],
  );
});

test("a figure the server didn't send is null, shown as a dash; zero is ₱0.00", () => {
  const figures = restructureWriteOffFigures({ write_off_amount: null, restructured_into: [successor({})] });
  assert.deepEqual(figures.map((f) => f.amount), [null, null]);
  assert.equal(restructureWriteOffFigures({}).every((f) => f.amount === null), true);
  assert.equal(writeOffFigureText(null), "—");
  assert.equal(writeOffFigureText(0), "₱0.00");
  assert.equal(writeOffFigureText(5000.01), "₱5,000.01");
});

test("the info card and the Balance tab show both labels, and no bare Written Off", () => {
  const notice = readFileSync(
    join(process.cwd(), "src/app/(app)/loans/[id]/_components/schedule-notice.tsx"),
    "utf8",
  );
  assert.ok(!notice.includes(">Written Off<"));
  assert.ok(!/written off\s*<\/>/.test(notice));
  assert.equal((notice.match(/restructureWriteOffFigures\(loan\)/g) ?? []).length, 2);
});
