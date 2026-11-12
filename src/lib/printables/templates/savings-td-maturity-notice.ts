/**
 * Time Deposit Maturity Notice, printed from a time deposit
 * (`GET /savings/time-deposits/{id}`).
 *
 * Every figure is the server's, fixed at placement: principal, interest, tax
 * and the amount due at maturity. What happens at maturity reads the
 * placement's own instruction. A settled placement says so instead.
 *
 * It states facts over a signature, so a placement that couldn't be read
 * prints blank and says so (`incomplete`).
 */

import { MATURITY_INSTRUCTION_LABELS, TD_STATUS_LABELS } from "@/app/(app)/savings/_lib/time-deposit-rules";
import { labelOf } from "@/app/(app)/savings/_lib/savings-rules";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  currencyOrDash,
  dateField,
  dateOrBlank,
  escapeHtml,
  field,
  fill,
  generatedAt,
  pick,
  type PrintableBuildOptions,
} from "./shared";
import { part, productName, ratePerAnnum, str } from "./savings-shared";

const AT_MATURITY: Record<string, string> = {
  payout: "the principal and the interest, less tax, will be paid out to you",
  rollover_principal:
    "the principal will be placed again for the same term at the rate in force on the maturity date, and the interest, less tax, paid out to you",
  rollover_all:
    "the principal and the interest, less tax, will be placed again for the same term at the rate in force on the maturity date",
};

export function buildTimeDepositMaturityNoticeDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const td = part(raw, "deposit");
  const status = str(td, "status");
  const open = status === "active" || status === "matured";
  const depositor = str(td, "borrower_name");
  const certificate = str(td, "certificate_number");
  const instruction = str(td, "maturity_instruction");
  const payoutAccount = str(td, "payout_account_number");
  const term = pick(td, ["term_days"]);

  const placed =
    `Dear ${fill(depositor)}, your time deposit, Certificate No. ${fill(certificate)}, ` +
    `placed on ${fill(dateOrBlank(str(td, "placement_date")))} for ${fill(typeof term === "number" ? `${term} days` : null)} ` +
    `at ${fill(ratePerAnnum(pick(td, ["annual_rate"])))}, `;
  const body = open
    ? placed +
      (status === "matured" ? "matured on " : "matures on ") +
      `${fill(dateOrBlank(str(td, "maturity_date")))}. ` +
      (instruction && AT_MATURITY[instruction]
        ? `As you instructed, ${escapeHtml(AT_MATURITY[instruction])}` +
          (instruction !== "rollover_all" && payoutAccount ? ` by credit to savings account No. ${escapeHtml(payoutAccount)}.` : ".")
        : "") +
      " To change this instruction, please contact the branch before the maturity date."
    : td
      ? placed + `has been settled (${escapeHtml(labelOf(TD_STATUS_LABELS, status).toLowerCase())}) on ${fill(dateOrBlank(str(td, "settled_on")))}.`
      : placed;

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Time Deposit Maturity Notice",
      subtitle: open ? (certificate ? `Certificate No. ${certificate}` : undefined) : td ? "SETTLED — FOR REFERENCE ONLY" : undefined,
    },
    {
      kind: "fields",
      columns: 2,
      items: [
        field("Certificate No.", certificate),
        field("Depositor", depositor),
        field("Member No.", str(td, "borrower_code")),
        field("Product", productName(td)),
        field("Branch", str(td, "branch_name")),
        dateField("Maturity date", str(td, "maturity_date")),
        field("Instruction at maturity", instruction ? labelOf(MATURITY_INSTRUCTION_LABELS, instruction) : null),
      ],
    },
    { kind: "paragraph", html: body },
    {
      kind: "charges",
      title: "At Maturity",
      lines: td
        ? [
            { label: "Principal", amount: currencyOrDash(str(td, "principal")) },
            { label: "Add: Interest for the term", amount: currencyOrDash(str(td, "gross_interest")), indent: true },
            { label: "Less: Withholding tax", amount: `(${currencyOrDash(str(td, "withholding_tax"))})`, indent: true },
            { label: "AMOUNT DUE AT MATURITY", amount: currencyOrDash(str(td, "maturity_amount")), rule: "grand" },
          ]
        : [{ label: "AMOUNT DUE AT MATURITY", amount: BLANK_LINE, rule: "grand" }],
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        { label: "For the Cooperative", detail: "Branch manager" },
        { label: "Received by", name: depositor, detail: "Depositor — signature and date" },
      ],
    },
  ];

  return {
    id: "time_deposit_maturity_notice",
    org: options.org ?? BLANK_ORG,
    title: "Time Deposit Maturity Notice",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: certificate ? `Time Deposit Maturity Notice • ${certificate}` : undefined,
    ...(td ? {} : { incomplete: true }),
  };
}
