/**
 * Dormancy Notice, printed from a savings account.
 *
 * A dormant account's notice says since when (the server's `dormant_since`)
 * and how to reactivate it. An active account's notice is a reminder: it
 * names the last activity and the dormancy period from the savings settings,
 * and never works a dormancy date out in the browser. The balance is the
 * server's ledger balance today.
 *
 * It states facts over a signature, so an account that couldn't be read
 * prints blank and says so (`incomplete`).
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  currencyOrDash,
  dateOrBlank,
  escapeHtml,
  fill,
  generatedAt,
  pick,
  type PrintableBuildOptions,
} from "./shared";
import { accountFields, accountStatus, part, productName, str } from "./savings-shared";

export function buildSavingsDormancyNoticeDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const account = part(raw, "account");
  const settings = part(raw, "settings");
  const status = str(account, "status");
  const months = pick(settings, ["dormancy_months"]);
  const period = typeof months === "number" ? `${months} months` : "the dormancy period";
  const lastActivity = str(account, "last_member_activity_on") ?? str(account, "opened_on");
  const branch = str(account, "branch_name");
  const depositor = str(account, "borrower_name");
  const number = str(account, "account_number");

  const opening =
    `Dear ${fill(depositor)}, this concerns your savings account No. ${fill(number)} ` +
    `(${escapeHtml(productName(account) ?? BLANK_LINE)}). `;
  const visit = `Visit the ${escapeHtml(branch ?? "")}${branch ? " " : ""}branch with a valid ID`;

  let body: string;
  let subtitle: string | undefined;
  if (status === "dormant") {
    subtitle = "Notice of Dormant Account";
    body =
      opening +
      `There has been no deposit, withdrawal or other activity by you on it since ${fill(dateOrBlank(lastActivity))}. ` +
      `An account with no activity by its depositor for ${escapeHtml(period)} is classified dormant, ` +
      `and your account has been dormant since ${fill(dateOrBlank(str(account, "dormant_since")))}. ` +
      "Your money is safe and keeps earning interest. " +
      `${visit} to make a deposit or to ask for the account to be reactivated.`;
  } else if (status === "active") {
    subtitle = "Reminder Before Dormancy";
    body =
      opening +
      `The last deposit, withdrawal or other activity by you on it was on ${fill(dateOrBlank(lastActivity))}. ` +
      `An account with no activity by its depositor for ${escapeHtml(period)} is classified dormant. ` +
      `To keep the account active, make a deposit or a withdrawal, or ${visit.charAt(0).toLowerCase()}${visit.slice(1)}.`;
  } else {
    body = account
      ? opening + `The account is ${escapeHtml(accountStatus(account).toLowerCase())}. A dormancy notice applies only to an active or dormant account.`
      : opening;
  }

  const blocks: PrintBlock[] = [
    { kind: "title", text: "Dormancy Notice", subtitle },
    { kind: "fields", title: "Account", columns: 2, items: accountFields(account) },
    { kind: "paragraph", html: body },
    {
      kind: "charges",
      lines: [{ label: "BALANCE TODAY", amount: account ? currencyOrDash(str(account, "balance")) : BLANK_LINE, rule: "grand" }],
    },
    { kind: "note", text: "If you have already transacted on this account, please disregard this notice." },
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
    id: "savings_dormancy_notice",
    org: options.org ?? BLANK_ORG,
    title: "Dormancy Notice",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: number ? `Dormancy Notice • ${number}` : undefined,
    ...(account ? {} : { incomplete: true }),
  };
}
