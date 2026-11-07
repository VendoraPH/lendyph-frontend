import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PORTAL_CONFIG } from "./default-config";
import {
  EMPTY_DRAFT,
  allowedDecisions,
  decisionNeedsResponse,
  applicationSteps,
  attachmentProblem,
  canCancel,
  maxWithdrawable,
  missingRequestFields,
  parseAmount,
  requestDetails,
  requestTypesFor,
  stepProblem,
  withdrawalProblem,
} from "./requests";
import type { PortalLoanProduct, PortalSavingsAccount } from "@/types/portal";

const account = (patch: Partial<PortalSavingsAccount> = {}): PortalSavingsAccount => ({
  id: 1,
  account_number: "SA-1",
  product_name: "Regular Savings",
  status: "active",
  balance: "24850.00",
  available_balance: "22850.00",
  interest_rate: 1,
  opened_at: null,
  ...patch,
});

const product = (patch: Partial<PortalLoanProduct> = {}): PortalLoanProduct => ({
  id: 7,
  name: "Salary Loan",
  description: null,
  min_amount: "5000.00",
  max_amount: "100000.00",
  min_term: 3,
  max_term: 24,
  term_unit: "months",
  interest_rate: 1.5,
  frequency: "monthly",
  requires_income_info: false,
  requires_collateral: false,
  required_documents: [],
  ...patch,
});

test("request types follow the portal's service switches", () => {
  const features = { ...DEFAULT_PORTAL_CONFIG.features, savings: true, withdrawal_requests: false, documents: false };
  const types = requestTypesFor(features);
  assert.ok(!types.includes("savings_withdrawal"));
  assert.ok(!types.includes("document_request"));
  assert.ok(types.includes("savings_opening"));
  assert.ok(types.includes("other"));
  assert.ok(requestTypesFor({ ...features, withdrawal_requests: true }).includes("savings_withdrawal"));
});

test("only the fields the member was asked count as missing or get sent", () => {
  const values = { account_id: "1", amount: "500", disbursement_method: "gcash", bank_name: "BDO" };
  assert.deepEqual(missingRequestFields("savings_withdrawal", values), ["GCash number"]);
  assert.deepEqual(requestDetails("savings_withdrawal", { ...values, gcash_number: " 0917 " }), {
    account_id: "1",
    amount: "500",
    disbursement_method: "gcash",
    gcash_number: "0917",
  });
  assert.deepEqual(missingRequestFields("savings_withdrawal", { ...values, disbursement_method: "bank" }), [
    "Account name",
    "Account number",
  ]);
});

test("parseAmount accepts plain and comma-grouped numbers only", () => {
  assert.equal(parseAmount("1,500.50"), 1500.5);
  assert.ok(Number.isNaN(parseAmount("1e3")));
  assert.ok(Number.isNaN(parseAmount("-5")));
  assert.ok(Number.isNaN(parseAmount("")));
});

test("withdrawals stop at what the account can release", () => {
  assert.equal(maxWithdrawable(account({ maintaining_balance: "500.00" })), 22350);
  assert.equal(maxWithdrawable(account({ withdrawable: "1000.00", maintaining_balance: "500.00" })), 1000);
  assert.equal(maxWithdrawable(account({ available_balance: "100", maintaining_balance: "500" })), 0);
  assert.equal(withdrawalProblem(2000, account({ withdrawable: "2000" })), null);
  assert.match(withdrawalProblem(2000.01, account({ withdrawable: "2000" }))!, /more than/);
  assert.match(withdrawalProblem(10.001, account())!, /two decimal/);
  assert.match(withdrawalProblem(10, account({ withdrawable: 0 }))!, /nothing available/);
});

test("attachments must be PDFs or images within the size limit", () => {
  assert.equal(attachmentProblem([{ name: "id.JPG", size: 1000 }]), null);
  assert.match(attachmentProblem([{ name: "x.docx", size: 1 }])!, /not a PDF/);
  assert.match(attachmentProblem([{ name: "big.pdf", size: 11 * 1024 * 1024 }])!, /larger/);
});

test("the application only asks for the steps the product needs", () => {
  assert.deepEqual(applicationSteps(product()), ["product", "loan", "review"]);
  assert.deepEqual(
    applicationSteps(product({ requires_income_info: true, requires_collateral: true, required_documents: ["Payslip"] })),
    ["product", "loan", "income", "collateral", "documents", "review"],
  );
});

test("each application step checks its own fields against the product", () => {
  const p = product({ required_documents: ["Payslip"] });
  assert.match(stepProblem("product", EMPTY_DRAFT, null)!, /Choose/);
  const loan = { ...EMPTY_DRAFT, amount: "4000", term: "12", purpose: "Tuition" };
  assert.match(stepProblem("loan", loan, p)!, /smallest/);
  assert.match(stepProblem("loan", { ...loan, amount: "20000", term: "30" }, p)!, /3 to 24 months/);
  assert.equal(stepProblem("loan", { ...loan, amount: "20,000" }, p), null);
  assert.match(stepProblem("income", { ...EMPTY_DRAFT, monthly_income: "abc" }, p)!, /monthly income/);
  assert.match(stepProblem("income", { ...EMPTY_DRAFT, monthly_income: "30000", other_income: "x" }, p)!, /Other income/);
  assert.match(stepProblem("documents", EMPTY_DRAFT, p)!, /Payslip/);
  const withFile = { ...EMPTY_DRAFT, documents: { Payslip: new File(["x"], "payslip.pdf") } };
  assert.equal(stepProblem("documents", withFile, p), null);
  assert.match(stepProblem("review", EMPTY_DRAFT, p)!, /declaration/);
});

test("only a request still waiting for review can be withdrawn", () => {
  assert.ok(canCancel("submitted"));
  assert.ok(!canCancel("under_review"));
});

test("allowedDecisions: open requests can be decided, closed ones cannot", () => {
  assert.deepEqual(allowedDecisions("submitted"), ["under_review", "need_info", "approve", "reject"]);
  assert.deepEqual(allowedDecisions("need_info"), ["need_info", "approve", "reject"]);
  assert.deepEqual(allowedDecisions("approved"), ["complete"]);
  for (const closed of ["rejected", "completed", "cancelled"] as const) {
    assert.deepEqual(allowedDecisions(closed), []);
  }
});

test("decisionNeedsResponse: only need_info and reject require a reply", () => {
  assert.equal(decisionNeedsResponse("need_info"), true);
  assert.equal(decisionNeedsResponse("reject"), true);
  assert.equal(decisionNeedsResponse("approve"), false);
  assert.equal(decisionNeedsResponse("complete"), false);
});
