/**
 * Demand Letter — Notice of Past Due Account.
 *
 * Source: `reportService.statementOfAccount(loanId)`. The statement already
 * carries the whole amortization schedule with per-period paid amounts, so the
 * overdue set is derived here rather than asking the API for a second view of
 * the same rows.
 *
 * A demand letter is the step before collection action, so it states only what
 * the ledger supports — and when it cannot read the ledger at all it states
 * nothing. Failing soft printed a notice with no member, no account number and
 * "TOTAL AMOUNT DEMANDED P0.00" over an authorised signatory's line: a demand
 * for nothing, served on nobody, that reads as a real one. It now blanks the
 * figure, replaces the arrears prose and marks itself as not to be served.
 *
 * When it CAN read the ledger it states only what that supports: the specific installments in arrears, what each still
 * owes, the total demanded, and the date by which it must be settled. The
 * consequences paragraph mirrors the acceleration and attorney's-fees clauses
 * the borrower already signed in the promissory note — it does not add new
 * remedies.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  addDays,
  asArray,
  asRecord,
  currencyOrDash,
  dateOrBlank,
  escapeHtml,
  field,
  formatCurrency,
  generatedAt,
  parseApiDate,
  pick,
  pickNumber,
  presentFields,
  startOfLocalDay,
  sum,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

/**
 * Days the member is given to settle before the account is endorsed for
 * collection. Cooperative policy, not a statutory period — when this becomes a
 * configurable setting it should be read from there rather than edited here.
 */
export const CURE_PERIOD_DAYS = 15;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between a due date and the letter date; null if undatable.
 *
 * Both sides are reduced to a local calendar day before they are subtracted,
 * and that is the whole of the function.
 *
 * `due_date` arrives as `"YYYY-MM-DD"` (`ReportService::statementOfAccount`
 * sends `->toDateString()`), which `new Date()` reads as UTC midnight — 08:00
 * in Manila. Subtracting a local `now` from that instant made every count an
 * hour-of-the-day question: before 08:00 an installment that fell due yesterday
 * measured 23 hours, floored to 0, and the `days_overdue > 0` filter below then
 * dropped it from the arrears table AND from the total demanded. A letter
 * printed at 07:00 demanded less money than the same letter printed at 09:00.
 *
 * Comparing calendar days makes the answer the same all day, which is what
 * "days late" means to the member reading it.
 */
function daysOverdue(dueDate: unknown, asOf: Date): number | null {
  const due = parseApiDate(dueDate);
  if (due === null) return null;
  const days = Math.round(
    (startOfLocalDay(asOf).getTime() - startOfLocalDay(due).getTime()) /
      MS_PER_DAY
  );
  return days > 0 ? days : 0;
}

/**
 * What an installment still owes on one component, to the centavo.
 *
 * Rounded because the subtraction is a float one: 16,666.67 − 6,666.67 lands on
 * 9,999.999999999998, and an unrounded figure like that reaches the table rows
 * raw. It formats to the right peso amount, but it also propagates into the
 * column totals — and a demand letter whose rows do not add up to its own total
 * is one a member can argue with.
 */
function remaining(row: Record<string, unknown>, dueKey: string, paidKey: string): number {
  const due = toNumber(row[dueKey]) ?? 0;
  const paid = toNumber(row[paidKey]) ?? 0;
  return Math.round(Math.max(0, due - paid) * 100) / 100;
}

export function buildDemandLetterDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const asOf = options.now ?? new Date();
  const root = asRecord(raw);
  /** The account could not be read: nothing below may demand a figure. */
  const incomplete = root === null;
  const loan = asRecord(pick(root, ["loan"])) ?? root;
  const borrower = asRecord(pick(root, ["borrower"]));
  const summary = asRecord(pick(root, ["summary", "totals"]));

  const borrowerName =
    pick(borrower, ["full_name", "name"]) ?? pick(root, ["borrower_name"]);
  const accountNumber =
    pick(loan, ["loan_account_number", "application_number"]) ?? null;

  // Overdue = due before today with something still unpaid. `status` is not
  // trusted on its own: a schedule only flips to 'overdue' when the nightly
  // job runs, so an installment that fell due this morning would be missed.
  const overdueRows = asArray(
    pick(root, ["amortization_schedule", "schedule", "amortization_schedules"])
  )
    .map((row) => {
      const principal = remaining(row, "principal_due", "principal_paid");
      const interest = remaining(row, "interest_due", "interest_paid");
      const penalty = remaining(row, "penalty_amount", "penalty_paid");
      return {
        period: pick(row, ["period_number", "period"]),
        due_date: pick(row, ["due_date"]),
        days_overdue: daysOverdue(pick(row, ["due_date"]), asOf),
        principal,
        interest,
        penalty,
        amount_due: Math.round((principal + interest + penalty) * 100) / 100,
      };
    })
    .filter((row) => row.amount_due > 0 && (row.days_overdue ?? 0) > 0);

  const totalDemanded = sum(overdueRows, "amount_due");
  const outstandingBalance =
    pickNumber(summary, ["outstanding_balance", "total_balance"]) ??
    pickNumber(root, ["outstanding_balance"]);
  const oldestDue = overdueRows.reduce<number | null>(
    (worst, row) =>
      row.days_overdue === null ? worst : Math.max(worst ?? 0, row.days_overdue),
    null
  );

  const settleBy = addDays(asOf, CURE_PERIOD_DAYS);

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Notice of Past Due Account",
      subtitle: incomplete
        ? "DATA UNAVAILABLE — DO NOT SERVE"
        : "Demand for Payment",
    },
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Date", dateOrBlank(asOf)),
        field("Loan Account No.", accountNumber),
        field("Member", borrowerName),
        field(
          "Member No.",
          pick(borrower, ["borrower_code", "member_no", "code"])
        ),
        field("Address", pick(borrower, ["address"])),
      ]),
    },
    {
      kind: "paragraph",
      align: "left",
      html: `Dear ${escapeHtml(borrowerName ? String(borrowerName) : "Member")},`,
    },
    incomplete
      ? {
          kind: "paragraph",
          align: "center",
          html:
            // See the note in promissory-note.ts on the &nbsp;.
            "<strong>*** D O &nbsp;N O T &nbsp;S E R V E ***</strong><br>" +
            "The loan account this notice refers to could not be retrieved when it was " +
            "printed, so no member, no account and no arrears are stated on it. " +
            "<strong>Nothing is demanded by this document.</strong> Retrieve the account " +
            "and print the notice again before any demand is made.",
        }
      : {
          kind: "paragraph",
          html:
            "Our records show that your loan account with the cooperative is in arrears. The " +
            "installments listed below have fallen due and remain unpaid as of " +
            `<strong>${escapeHtml(dateOrBlank(asOf))}</strong>.`,
        },
    {
      kind: "table",
      title: "Installments in Arrears",
      columns: [
        { key: "period", header: "Period", align: "center", width: "8%" },
        { key: "due_date", header: "Due Date", format: "date", width: "17%" },
        { key: "days_overdue", header: "Days Late", format: "number", align: "right", width: "11%" },
        { key: "principal", header: "Principal", format: "currency", align: "right", width: "16%" },
        { key: "interest", header: "Interest", format: "currency", align: "right", width: "16%" },
        { key: "penalty", header: "Penalty", format: "currency", align: "right", width: "16%" },
        { key: "amount_due", header: "Amount Due", format: "currency", align: "right", width: "16%" },
      ],
      rows: overdueRows,
      totals:
        overdueRows.length > 0
          ? {
              days_overdue: "TOTAL",
              principal: formatCurrency(sum(overdueRows, "principal")),
              interest: formatCurrency(sum(overdueRows, "interest")),
              penalty: formatCurrency(sum(overdueRows, "penalty")),
              amount_due: formatCurrency(totalDemanded),
            }
          : undefined,
      emptyText: incomplete
        ? "The account's amortization schedule could not be retrieved. No installment is demanded by this notice."
        : "No installment on this account is past due as of the date of this notice.",
    },
    {
      kind: "charges",
      lines: [
        {
          label: "TOTAL AMOUNT DEMANDED",
          // A blank rule, never P0.00 — a notice that demands zero pesos over
          // a signatory's name is still a notice.
          amount: incomplete ? BLANK_LINE : formatCurrency(totalDemanded),
          rule: "grand",
        },
      ],
    },
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Total outstanding balance", currencyOrDash(outstandingBalance)),
        field(
          "Longest overdue installment",
          oldestDue === null ? null : `${oldestDue} day(s)`
        ),
        field("Settle on or before", dateOrBlank(settleBy)),
      ]),
    },
    {
      kind: "paragraph",
      html:
        "You are hereby requested to settle the total amount demanded on or before " +
        `<strong>${escapeHtml(dateOrBlank(settleBy))}</strong>, being ${CURE_PERIOD_DAYS} ` +
        "days from the date of this notice. Payment may be made at any branch of the " +
        "cooperative during business hours.",
    },
    {
      kind: "paragraph",
      html:
        "Should the account remain unsettled after the date stated above, the entire " +
        "outstanding balance of the loan — principal, accrued interest, penalties and other " +
        "charges — shall become due and demandable in full without need of further notice, " +
        "in accordance with the acceleration clause of the Promissory Note you executed. " +
        "The account may then be endorsed for collection, and any attorney's fees and costs " +
        "of collection provided for in that Note shall be for your account. Your co-maker, " +
        "being solidarily liable, may likewise be proceeded against directly.",
    },
    {
      kind: "paragraph",
      html:
        "If you have already paid, or if you wish to discuss a restructuring of your account, " +
        "please contact us immediately so this notice may be disregarded or your account " +
        "reviewed. We value your membership and would prefer to resolve this with you.",
    },
    {
      kind: "paragraph",
      align: "left",
      html: "Very truly yours,",
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        {
          label: "Authorized Signatory",
          detail: "Collection / Credit Officer",
        },
        {
          label: "Noted by",
          detail: "Branch Manager",
        },
      ],
    },
    {
      kind: "note",
      text:
        "Received a copy of this notice: _______________________________  Date: ______________",
    },
  ];

  return {
    id: "demand_letter",
    org: options.org ?? BLANK_ORG,
    title: "Notice of Past Due Account",
    generatedAt: generatedAt(options.now),
    blocks,
    incomplete: incomplete || undefined,
    footerNote: incomplete
      ? "DATA UNAVAILABLE — NOT A DEMAND. DO NOT SERVE."
      : accountNumber
        ? `Notice of Past Due Account • Loan ${accountNumber}`
        : undefined,
  };
}
