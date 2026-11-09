/**
 * Editing a loan through the loan form, and a restructure in particular (a
 * restructure sent back for approval is edited here before it is submitted
 * again). The rules follow the server's `UpdateLoanRequest` and
 * `LoanService::updateLoan()`.
 *
 * WHAT THIS PROVES: the principal takes pesos and centavos; a restructure has
 * no product minimum (the server exempts it) and no range check at all when its
 * principal is unchanged; a restructure's build-up is never held to the
 * product's range (the server takes any amount from ₱0.00) and is always sent,
 * ₱0.00 included; the remarks go up only when the principal changed; and the
 * server's 422 on `remarks` is read so the field can ask for them.
 * WHAT IT DOES NOT PROVE: the server's rules (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  amountInputValue,
  principalMoved,
  principalRangeError,
  remarksRequired,
  REMARKS_SAVED_HINT,
  remarksRefusal,
  restructureEditFields,
  scbRuleError,
} from "./restructure-edit";

const PRODUCT = { min_amount: 20000, max_amount: 100000, scb_required: true, min_scb: 100, max_scb: 500 };

test("the principal keeps centavos, two decimals at most", () => {
  assert.equal(amountInputValue("19666.67"), "19666.67");
  assert.equal(amountInputValue("19,666.675"), "19666.67");
  assert.equal(amountInputValue("1.2.3"), "1.23");
  assert.equal(amountInputValue("abc"), "");
  assert.equal(amountInputValue("15000"), "15000");
});

test("an ordinary loan keeps the product's principal range", () => {
  assert.match(principalRangeError(15000, PRODUCT, { isRestructure: false, storedPrincipal: null }) ?? "", /Minimum amount/);
  assert.match(principalRangeError(200000, PRODUCT, { isRestructure: false, storedPrincipal: null }) ?? "", /Maximum amount/);
  assert.equal(principalRangeError(50000, PRODUCT, { isRestructure: false, storedPrincipal: null }), null);
});

test("a restructure has no product minimum, and no check when its principal is unchanged", () => {
  assert.equal(principalRangeError(19666.67, PRODUCT, { isRestructure: true, storedPrincipal: 25000 }), null);
  assert.match(principalRangeError(200000, PRODUCT, { isRestructure: true, storedPrincipal: 25000 }) ?? "", /Maximum amount/);
  assert.equal(principalRangeError(200000, PRODUCT, { isRestructure: true, storedPrincipal: 200000 }), null);
});

test("a restructure's build-up is never held to the product's range", () => {
  assert.equal(scbRuleError("", PRODUCT, true), null);
  assert.equal(scbRuleError("0", PRODUCT, true), null);
  assert.equal(scbRuleError("50", PRODUCT, true), null);
  assert.equal(scbRuleError("-1", PRODUCT, true), "SCB cannot be negative");
});

test("an ordinary loan keeps the product's build-up rule", () => {
  assert.equal(scbRuleError("", PRODUCT, false), "Share Capital Build-Up amount is required");
  assert.equal(scbRuleError("50", PRODUCT, false), `Minimum SCB is ₱100.00`);
  assert.equal(scbRuleError("600", PRODUCT, false), `Maximum SCB is ₱500.00`);
  assert.equal(scbRuleError("200", PRODUCT, false), null);
  assert.equal(scbRuleError("", { ...PRODUCT, scb_required: false }, false), null);
});

test("a restructure edit sends its build-up, ₱0.00 included, and remarks only with a changed principal", () => {
  assert.deepEqual(restructureEditFields({ principal: 19666.67, storedPrincipal: 19666.67, scb: 0, remarks: "x" }), {
    scb_amount: 0,
  });
  assert.deepEqual(restructureEditFields({ principal: 18000, storedPrincipal: 19666.67, scb: 0, remarks: "  Member asked  " }), {
    scb_amount: 0,
    remarks: "Member asked",
  });
  assert.deepEqual(restructureEditFields({ principal: 18000, storedPrincipal: 19666.67, scb: 0, remarks: "  " }), {
    scb_amount: 0,
  });
});

test("remarks are required only while the principal differs from the stored one", () => {
  const message = "Remarks are required when the restructured principal is less than the outstanding balance.";
  assert.equal(principalMoved(18000, 19666.67), true);
  assert.equal(principalMoved(19666.67, 19666.67), false);
  assert.equal(principalMoved(19666.67, null), true);
  assert.equal(remarksRequired(message, 18000, 19666.67), true);
  // Back to the stored principal: the server keeps its stored remarks, so none are asked for.
  assert.equal(remarksRequired(message, 19666.67, 19666.67), false);
  assert.equal(remarksRequired(null, 18000, 19666.67), false);
});

test("the Remarks field says they are saved only with a changed principal", () => {
  assert.equal(REMARKS_SAVED_HINT, "Saved only when the principal changes; otherwise the restructure keeps its remarks.");
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/new/page.tsx"), "utf8");
  assert.ok(page.includes("{REMARKS_SAVED_HINT}"));
  assert.ok(page.includes("remarksRequired(remarksRequiredMessage, principal, storedPrincipal)"));
});

test("the server's 422 on remarks is read so the form can ask for them", () => {
  const message = "Remarks are required when the restructured principal is less than the outstanding balance.";
  assert.equal(remarksRefusal({ response: { status: 422, data: { message, errors: { remarks: [message] } } } }), message);
  assert.equal(remarksRefusal({ response: { status: 422, data: { errors: { principal_amount: ["x"] } } } }), null);
  assert.equal(remarksRefusal(new Error("network")), null);
});

test("the loan form wires the principal, build-up and remarks rules", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/new/page.tsx"), "utf8");
  assert.ok(!page.includes('setPrincipalAmount(e.target.value.replace(/\\D/g, ""))'));
  assert.ok(page.includes("setPrincipalAmount(amountInputValue(e.target.value))"));
  assert.ok(page.includes("scbRuleError(scbAmount, selectedProduct, isRestructureEdit)"));
  assert.ok(page.includes("remarksRefusal(err)"));
  assert.ok(page.includes('htmlFor="restructure-remarks"'));
});
