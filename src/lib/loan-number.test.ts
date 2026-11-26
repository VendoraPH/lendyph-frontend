import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loanNumberLabel } from "./loan-number";

test("the server's display number wins", () => {
  assert.equal(
    loanNumberLabel({ display_number: "OLD-2023-0041", loan_account_number: null, application_number: "LA-000006" }),
    "OLD-2023-0041",
  );
  assert.equal(loanNumberLabel({ loan_display_number: "BC-07", loan_account_number: null }), "BC-07");
});

test("without it, the LN- number, then the file's Loan No., then the application number", () => {
  assert.equal(loanNumberLabel({ loan_account_number: "LN-000042", application_number: "LA-000042" }), "LN-000042");
  assert.equal(
    loanNumberLabel({ loan_account_number: null, external_loan_no: "L-2019-0042", application_number: "LA-000006" }),
    "L-2019-0042",
  );
  assert.equal(loanNumberLabel({ loan_account_number: "", external_loan_no: "  ", application_number: "LA-000006" }), "LA-000006");
});

test("a row with no number reads the fallback, never a made-up LN- number", () => {
  assert.equal(loanNumberLabel({}), "—");
  assert.equal(loanNumberLabel(null), "—");
  assert.equal(loanNumberLabel(undefined, "Loan #6"), "Loan #6");
});

/** Every source file under src, tests excluded. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

test("no screen invents a loan number from the loan's id", () => {
  const offenders = sources(join(process.cwd(), "src")).filter((file) =>
    /`LN-\$\{/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, []);
});
