/**
 * Savings Account Agreement, printed from a savings account.
 *
 * The terms are the account's product as the server holds it today (rates,
 * balances, limits, the free withdrawals and their fee) and the savings
 * settings (dormancy period, members' tax rate). A rule the product doesn't
 * set is left out rather than guessed. A legal document, so it says
 * "Depositor".
 */

import { formatRate } from "@/lib/format";
import { INTEREST_CREDITING_LABELS, labelOf } from "@/app/(app)/savings/_lib/savings-rules";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  asArray,
  asRecord,
  currencyOrDash,
  dateOrBlank,
  escapeHtml,
  fill,
  generatedAt,
  pick,
  type PrintableBuildOptions,
} from "./shared";
import { part, productName, ratePerAnnum, str } from "./savings-shared";

/** The product's rates in force, one line each: "Any balance: 2% per annum", "₱50,000.00 and up: 2.5% per annum". */
export function rateLines(product: Record<string, unknown> | null): string[] {
  return asArray(pick(product, ["current_rates"])).flatMap((rate) => {
    const perAnnum = ratePerAnnum(rate.annual_rate);
    if (!perAnnum) return [];
    const floor = rate.min_balance;
    const band =
      floor === null || floor === undefined || floor === "" ? "Any balance" : `${currencyOrDash(floor)} and up`;
    return [`${band}: ${perAnnum}`];
  });
}

const clause = (n: number, title: string, body: string) =>
  `<strong>${n}. ${escapeHtml(title)}.</strong> ${body}`;

export function buildSavingsAgreementDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const account = part(raw, "account");
  const product = part(raw, "product");
  const settings = part(raw, "settings");
  const depositor = str(account, "borrower_name");
  const org = options.org?.name?.trim() || null;
  const money = (key: string) => {
    const value = str(product, key);
    return value === null ? null : escapeHtml(currencyOrDash(value));
  };

  const rates = rateLines(product);
  const crediting = str(product, "interest_crediting");
  const minAdb = money("minimum_adb_for_interest");
  const interest =
    (rates.length > 0
      ? `Interest is paid at ${rates.map(escapeHtml).join("; ")}`
      : "Interest is paid at the rate the Cooperative sets for this product") +
    ", on the average daily balance, counting the actual days over a 365-day year" +
    (crediting ? `, credited ${escapeHtml(labelOf(INTEREST_CREDITING_LABELS, crediting).toLowerCase())}` : "") +
    "." +
    (minAdb ? ` A period whose average daily balance is below ${minAdb} earns no interest.` : "") +
    " The Cooperative may change the rate; a change applies from the date it takes effect.";

  const balances = [
    money("minimum_opening_balance") && `The account is opened with at least ${money("minimum_opening_balance")}.`,
    money("maintaining_balance") && `A withdrawal may not take the balance below the maintaining balance of ${money("maintaining_balance")}.`,
    money("max_balance") && `The balance may not exceed ${money("max_balance")}.`,
  ].filter(Boolean);

  const deposits = [
    pick(product, ["allow_deposits"]) === false && "This product does not take deposits.",
    money("min_deposit") && `Each deposit is at least ${money("min_deposit")}.`,
    money("max_deposit") && `Each deposit is at most ${money("max_deposit")}.`,
  ].filter(Boolean);

  const freeCount = pick(product, ["free_withdrawals_per_month"]);
  const fee = money("excess_withdrawal_fee");
  const withdrawals = [
    pick(product, ["allow_withdrawals"]) === false && "This product does not allow withdrawals.",
    money("min_withdrawal") && `Each withdrawal is at least ${money("min_withdrawal")}.`,
    money("max_withdrawal") && `Each withdrawal is at most ${money("max_withdrawal")}.`,
    typeof freeCount === "number" &&
      `${freeCount} ${freeCount === 1 ? "withdrawal is" : "withdrawals are"} free each calendar month; ` +
        (fee ? `each further withdrawal is charged a fee of ${fee}.` : "further withdrawals in the month are refused."),
    "Money on hold or waiting for approval, and the maintaining balance, can't be withdrawn. Larger withdrawals need the approval of authorised officers.",
  ].filter(Boolean);

  const months = pick(settings, ["dormancy_months"]);
  const memberTax = pick(asRecord(pick(settings, ["current_tax_rates"])), ["member"]);

  const terms = [
    clause(1, "Interest", interest),
    clause(2, "Balances", balances.length > 0 ? balances.join(" ") : "The product's balance rules apply."),
    clause(3, "Deposits", deposits.length > 0 ? deposits.join(" ") : "Deposits are made at the branch or through the channels the Cooperative accepts."),
    clause(4, "Withdrawals", withdrawals.join(" ")),
    clause(
      5,
      "Dormancy",
      (typeof months === "number"
        ? `An account with no deposit, withdrawal or other activity by the Depositor for ${months} months becomes dormant.`
        : "An account with no activity by the Depositor for the dormancy period the Cooperative sets becomes dormant.") +
        " A dormant account keeps earning interest and is reactivated at the branch.",
    ),
    clause(
      6,
      "Tax",
      memberTax !== null && memberTax !== undefined
        ? `Interest is subject to the withholding tax in force; for members it is currently ${escapeHtml(formatRate(memberTax as string))}%.`
        : "Interest is subject to the withholding tax in force.",
    ),
    clause(7, "Closing", "The Depositor may close the account at the branch. The balance and the interest earned to the closing date, less tax, are paid out once no hold or pending transaction remains."),
    clause(8, "Records", "The Cooperative's records of the account are the basis of its balance. The Depositor should report any error in a passbook, receipt or statement promptly."),
  ];

  const blocks: PrintBlock[] = [
    { kind: "title", text: "Savings Account Agreement", subtitle: productName(account) ?? undefined },
    {
      kind: "paragraph",
      html:
        `This agreement is between ${fill(org)} (the "Cooperative") and ${fill(depositor)}, ` +
        `Member No. ${fill(str(account, "borrower_code"))} (the "Depositor"), for savings account ` +
        `No. ${fill(str(account, "account_number"))} under the ${fill(productName(account))} product, ` +
        `opened on ${fill(str(account, "opened_on") ? dateOrBlank(str(account, "opened_on")) : null)}.`,
    },
    { kind: "heading", text: "Terms" },
    ...terms.map((html): PrintBlock => ({ kind: "paragraph", html })),
    {
      kind: "paragraph",
      html: "The Depositor has read these terms, understood them, and agrees to them.",
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        { label: "Depositor", name: depositor ?? null, detail: "Signature over printed name" },
        { label: "For the Cooperative", detail: "Authorised officer" },
      ],
    },
  ];

  const number = str(account, "account_number");
  return {
    id: "savings_agreement",
    org: options.org ?? BLANK_ORG,
    title: "Savings Account Agreement",
    generatedAt: generatedAt(options.now),
    copies: ["Depositor's Copy", "File Copy"],
    blocks,
    footerNote: number ? `Savings Account Agreement • ${number}` : `Savings Account Agreement • ${BLANK_LINE}`,
  };
}
