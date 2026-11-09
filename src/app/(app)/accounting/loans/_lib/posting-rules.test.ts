import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTHING_POSTS, POSTING_RULES } from "./posting-rules";

function allText(): string {
  return [
    ...POSTING_RULES.flatMap((rule) => [rule.event, ...rule.debit, ...rule.credit, rule.note]),
    NOTHING_POSTS.title,
    ...NOTHING_POSTS.events,
    NOTHING_POSTS.note,
  ].join("\n");
}

test("no rule says interest or penalty is accrued: the books are on a cash basis", () => {
  const text = allText();
  assert.doesNotMatch(text, /accru/i);
  assert.doesNotMatch(text, /Interest Receivable|Penalty Receivable/);
  assert.equal(
    POSTING_RULES.some((rule) => /^(Interest earned|Penalty charged)$/i.test(rule.event)),
    false,
  );
});

test("every entry names at least one debit and one credit", () => {
  assert.ok(POSTING_RULES.length > 0);
  for (const rule of POSTING_RULES) {
    assert.ok(rule.debit.length > 0, `${rule.event} has no debit`);
    assert.ok(rule.credit.length > 0, `${rule.event} has no credit`);
    for (const account of [...rule.debit, ...rule.credit]) {
      assert.ok(account.trim().length > 0, `${rule.event} names an empty account`);
    }
    assert.ok(rule.note.trim().length > 0, `${rule.event} has no note`);
  }
});

test("each event is listed once", () => {
  const events = POSTING_RULES.map((rule) => rule.event);
  assert.equal(new Set(events).size, events.length);
});

function rule(event: RegExp) {
  const found = POSTING_RULES.find((r) => event.test(r.event));
  assert.ok(found, `no entry for ${event}`);
  return found;
}

test("a release pays out the net proceeds and credits each deduction's own account", () => {
  const release = rule(/^Loan released$/);
  assert.deepEqual(release.debit, ["Loans Receivable"]);
  assert.ok(release.credit.some((c) => /money account/i.test(c) && /net proceeds/i.test(c)));
  assert.ok(release.credit.some((c) => /each deduction's own account/i.test(c)));
});

test("a payment credits principal, interest, penalty, premium, build-up and overpayment", () => {
  const payment = rule(/^Payment collected$/);
  for (const account of [
    "Loans Receivable",
    "Interest Income",
    "Penalty Income",
    "Insurance Premium Payable",
    "Share Capital",
    "Other Liabilities",
  ]) {
    assert.ok(
      payment.credit.some((c) => c.startsWith(account)),
      `payment does not credit ${account}`,
    );
  }
  assert.match(payment.note, /restructured loan/i);
});

test("the restructure entries are present: release, and the principal written off", () => {
  const release = rule(/^Restructure released$/);
  assert.ok(release.credit.some((c) => /Unearned Interest and Penalty/.test(c)));
  assert.match(release.note, /nothing is paid out/i);
  assert.match(release.note, /collected from the member/i);

  const writeOff = rule(/written off/i);
  assert.deepEqual(writeOff.credit, ["Loans Receivable"]);
  assert.deepEqual(writeOff.debit, [
    "Unearned Interest and Penalty – Restructured Loans",
    "Allowance for Credit Losses",
    "Credit Loss Expense",
  ]);
});

test("the balance adjustment entry goes through Loan Adjustments Clearing", () => {
  const adjustment = rule(/^Balance adjustment$/);
  const sides = [...adjustment.debit, ...adjustment.credit];
  assert.ok(sides.some((s) => s.startsWith("Loan Adjustments Clearing")));
  assert.ok(sides.some((s) => s.startsWith("Loans Receivable")));
  assert.match(adjustment.note, /needs review/i);
});

test("a reduction on a loan holding unearned income also clears its matching share", () => {
  const adjustment = rule(/^Balance adjustment$/);
  assert.ok(
    adjustment.debit.includes(
      "Unearned Interest and Penalty – Restructured Loans (a reduction's matching share)",
    ),
  );
  assert.equal(adjustment.credit.filter((c) => c.startsWith("Loan Adjustments Clearing")).length, 2);
  assert.match(adjustment.note, /matching share/i);
});

test("the old loan's unearned income left after its write-off carries to the new loan", () => {
  assert.match(rule(/^Restructure released$/).note, /left after its write-off carries to the new loan/i);
});

test("a restructure write-off spells out its order: own unearned income, the allowance, then expense", () => {
  assert.match(
    rule(/^Allowance for credit losses$/).note,
    /old loan's own unearned interest and penalty first, then the allowance, then Credit Loss Expense/,
  );
});

test("a Cash Out posts when it is created, which completes it", () => {
  assert.match(rule(/^GCash Cash Out$/).note, /created, which completes it/i);
});

test("share capital, GCash, the allowance and a void are each written", () => {
  assert.deepEqual(rule(/^Share capital entry$/).credit, ["Share Capital"]);
  assert.ok(rule(/^GCash Cash In$/).credit.includes("GCash Service Income (the charge)"));
  assert.ok(rule(/^GCash Cash Out$/).credit.includes("GCash Service Income (the charge)"));
  const allowance = rule(/^Allowance for credit losses$/);
  assert.deepEqual(allowance.debit, ["Credit Loss Expense"]);
  assert.deepEqual(allowance.credit, ["Allowance for Credit Losses"]);
  assert.match(allowance.note, /principal only/i);
  assert.match(rule(/^Payment voided$/).note, /reverses/i);
});

test("cash basis: interest falling due, a penalty charged or waived and deferred extension interest post nothing", () => {
  const events = NOTHING_POSTS.events.join(" ");
  assert.match(events, /interest falls due/i);
  assert.match(events, /penalty is charged/i);
  assert.match(events, /penalty is waived/i);
  assert.match(events, /extension interest is deferred/i);
});
