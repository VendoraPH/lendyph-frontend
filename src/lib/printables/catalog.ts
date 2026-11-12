import {
  BellRing,
  BookUser,
  CalendarClock,
  FileSignature,
  FileText,
  FileX,
  HandCoins,
  Landmark,
  MoonStar,
  ReceiptText,
  ScrollText,
  TimerOff,
  UserPlus,
  Wallet,
} from "lucide-react";
import { env } from "@/config/env";
import type { Permission } from "@/types";
import {
  loanDocumentService,
  loanService,
  repaymentService,
  reportService,
  shareCapitalService,
} from "@/services";
import type {
  PrintableContext,
  PrintableDefinition,
  PrintableDocument,
} from "./types";
import { buildAmortizationScheduleDoc } from "./templates/amortization-schedule";
import { buildDemandLetterDoc } from "./templates/demand-letter";
import { buildDisclosureDoc } from "./templates/disclosure";
import { buildMemberLedgerCardDoc } from "./templates/member-ledger-card";
import { buildOfficialReceiptDoc } from "./templates/official-receipt";
import { buildPromissoryNoteDoc } from "./templates/promissory-note";
import { buildReleaseVoucherDoc } from "./templates/release-voucher";
import {
  buildShareCapitalCertificateDoc,
  toShareCapitalLedgerFallback,
} from "./templates/share-capital-certificate";
import { PRINT_PAGE_SIZE, type PrintableBuildOptions } from "./templates/shared";
import { buildSavingsAgreementDoc } from "./templates/savings-agreement";
import { buildSavingsClosureFormDoc } from "./templates/savings-closure-form";
import { buildSavingsDormancyNoticeDoc } from "./templates/savings-dormancy-notice";
import { buildSavingsOpeningFormDoc } from "./templates/savings-opening-form";
import { buildTimeDepositEarlyTerminationDoc } from "./templates/savings-td-early-termination";
import { buildTimeDepositMaturityNoticeDoc } from "./templates/savings-td-maturity-notice";
import { buildSavingsWithdrawalSlipDoc } from "./templates/savings-withdrawal-slip";
import {
  fetchSavingsAccountPayload,
  fetchSavingsWithdrawalPayload,
  fetchTimeDepositPayload,
} from "./savings-fetchers";
import { PRINTABLE_TITLES } from "@/lib/page-titles";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

/**
 * Fetch wiring + the catalog itself, mirroring
 * `reports/_lib/report-catalog.ts`. Every payload→document mapping lives in
 * `templates/`, so the whole API-to-paper contract stays unit-testable.
 *
 * **Adding a ninth document is one template file plus one entry below.** If it
 * ever needs more than that, the abstraction is wrong.
 */

type SubjectFetcher = (subjectId: number) => Promise<unknown>;
type TemplateBuilder = (
  raw: unknown,
  options: PrintableBuildOptions
) => PrintableDocument;

/**
 * The server refused to give this record's document (a 422: a disclosure for a
 * loan that's still for approval, say). That isn't the API being unreachable,
 * so no blank form opens: the message, in the server's words, says why.
 */
export class PrintableRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintableRefusedError";
  }
}

function refusedOrNull(err: unknown): null {
  if (httpStatusOf(err) === 422) {
    throw new PrintableRefusedError(
      getErrorMessage(err, "This document can't be printed for this record yet."),
    );
  }
  return null;
}

/**
 * A failed request must still produce a document, unless the server refused
 * it (`PrintableRefusedError`, above).
 *
 * This is the printables' version of `reportBuilder`'s soft failure, and it
 * matters more here than it does for a report: a blank release voucher or
 * demand letter is a form the branch can print and complete by hand when the
 * API is unreachable, which is exactly what a cooperative falls back to. So a
 * rejection maps to `null`, and the templates turn `null` into a skeleton.
 */
function printableBuilder(fetcher: SubjectFetcher, build: TemplateBuilder) {
  return async (ctx: PrintableContext): Promise<PrintableDocument> => {
    // The detail page blocks the action until a subject is picked, so this
    // guards a malformed call rather than an expected state.
    if (!ctx.subjectId) return build(null, { org: ctx.org });
    const raw = await fetcher(ctx.subjectId).catch(refusedOrNull);
    const doc = build(raw, { org: ctx.org });
    return raw === null ? doc : { ...doc, subjectId: ctx.subjectId };
  };
}

/**
 * Share capital reads the new statement endpoint, which is the only one that
 * can give an opening balance and a running balance over the whole ledger.
 *
 * The paginated list is the fallback rather than the primary because
 * `per_page` caps at 100 — `ShareCapitalLedgerController::index()` does
 * `paginate(min((int) request('per_page', 15), 100))`, so asking for more than
 * that changes nothing. A long-standing member's ledger comes back as one page,
 * and a closing balance derived from one page of a longer ledger is not the
 * member's share capital.
 *
 * That does not make the fallback useless — the recent entries are worth
 * printing when a deployment's backend is behind the frontend and the statement
 * route 404s. It makes it a different document: the list carries no balances,
 * so `share-capital-certificate.ts` prints it as an extract rather than a
 * certificate, and the response is normalised here with a note of whether it
 * may have been capped.
 */
async function fetchShareCapitalStatement(borrowerId: number): Promise<unknown> {
  try {
    return await reportService.shareCapitalStatement(borrowerId);
  } catch {
    // Fall through to the list.
  }

  const ledger = await shareCapitalService
    .ledgerList({ borrower_id: borrowerId, per_page: PRINT_PAGE_SIZE })
    .catch(() => null);

  // `null` has to keep meaning "nothing could be read" — an empty page of a
  // real ledger must not look like a failed request, so the list is always
  // wrapped, never handed on as a bare array.
  return ledger === null
    ? null
    : toShareCapitalLedgerFallback(ledger, PRINT_PAGE_SIZE);
}

/** Savings documents need `savings:view` and the deployment's savings switch. */
const SAVINGS_DOCUMENT = { permission: "savings:view", available: env.features.savings } as const;

// ---------------------------------------------------------------------------
// Exported catalog
// ---------------------------------------------------------------------------

export const PRINTABLE_CATALOG: PrintableDefinition[] = [
  {
    id: "disclosure_statement",
    title: PRINTABLE_TITLES.disclosure_statement,
    description:
      "Finance charges, net proceeds and rate disclosure required by R.A. 3765.",
    subject: "loan",
    icon: FileText,
    build: printableBuilder(
      (id) => loanDocumentService.disclosure(id),
      buildDisclosureDoc
    ),
  },
  {
    id: "promissory_note",
    title: PRINTABLE_TITLES.promissory_note,
    description:
      "The member's undertaking to pay, with co-maker clause and notarial block.",
    subject: "loan",
    icon: FileSignature,
    build: printableBuilder(
      (id) => loanDocumentService.promissoryNote(id),
      buildPromissoryNoteDoc
    ),
  },
  {
    id: "release_voucher",
    title: PRINTABLE_TITLES.release_voucher,
    description:
      "Principal, itemised deductions and net proceeds, signed on release.",
    subject: "loan",
    icon: Wallet,
    build: printableBuilder((id) => loanService.detail(id), buildReleaseVoucherDoc),
  },
  {
    id: "amortization_schedule",
    title: PRINTABLE_TITLES.amortization_schedule,
    description: "Per-period principal, interest and balance for one loan.",
    subject: "loan",
    icon: CalendarClock,
    build: printableBuilder(
      (id) => loanService.detail(id),
      buildAmortizationScheduleDoc
    ),
  },
  {
    id: "demand_letter",
    title: PRINTABLE_TITLES.demand_letter,
    description:
      "Notice of past due: installments in arrears, total demanded, cure period.",
    subject: "loan",
    icon: ScrollText,
    build: printableBuilder(
      (id) => reportService.statementOfAccount(id),
      buildDemandLetterDoc
    ),
  },
  {
    id: "official_receipt",
    title: PRINTABLE_TITLES.official_receipt,
    description:
      "Two copies — member's and file — with the payment's full application.",
    subject: "repayment",
    icon: ReceiptText,
    build: printableBuilder(
      (id) => repaymentService.detail(id),
      buildOfficialReceiptDoc
    ),
  },
  {
    id: "share_capital_certificate",
    title: PRINTABLE_TITLES.share_capital_certificate,
    description:
      "Member's share capital ledger with running balance and closing balance.",
    subject: "borrower",
    icon: Landmark,
    build: printableBuilder(
      fetchShareCapitalStatement,
      buildShareCapitalCertificateDoc
    ),
  },
  {
    id: "member_ledger_card",
    title: PRINTABLE_TITLES.member_ledger_card,
    description: "Every loan account a member holds, with payments and balances.",
    subject: "borrower",
    icon: BookUser,
    build: printableBuilder(
      (id) => reportService.subsidiaryLedger(id),
      buildMemberLedgerCardDoc
    ),
  },
  // Savings & Deposits (the Savings task's TASK 39): listed only where
  // NEXT_PUBLIC_ENABLE_SAVINGS is on, to users who hold savings:view.
  {
    id: "savings_opening_form",
    title: PRINTABLE_TITLES.savings_opening_form,
    description: "The account, depositor, beneficiary and source of funds, for the depositor to sign.",
    subject: "savings_account",
    icon: UserPlus,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder(
      (id) => fetchSavingsAccountPayload(id, { member: true, product: true }),
      buildSavingsOpeningFormDoc
    ),
  },
  {
    id: "savings_agreement",
    title: PRINTABLE_TITLES.savings_agreement,
    description: "The product's interest, balance, withdrawal, fee and dormancy terms, signed by both sides.",
    subject: "savings_account",
    icon: FileSignature,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder(
      (id) => fetchSavingsAccountPayload(id, { product: true, settings: true }),
      buildSavingsAgreementDoc
    ),
  },
  {
    id: "savings_closure_form",
    title: PRINTABLE_TITLES.savings_closure_form,
    description: "The request to close an account, with today's closing figures from the server.",
    subject: "savings_account",
    icon: FileX,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder(
      (id) => fetchSavingsAccountPayload(id, { closing: true }),
      buildSavingsClosureFormDoc
    ),
  },
  {
    id: "savings_dormancy_notice",
    title: PRINTABLE_TITLES.savings_dormancy_notice,
    description: "A notice that an account is dormant, or a reminder before it becomes dormant.",
    subject: "savings_account",
    icon: MoonStar,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder(
      (id) => fetchSavingsAccountPayload(id, { settings: true }),
      buildSavingsDormancyNoticeDoc
    ),
  },
  {
    id: "savings_withdrawal_slip",
    title: PRINTABLE_TITLES.savings_withdrawal_slip,
    description: "A posted withdrawal in figures and words, for the depositor and the teller to sign.",
    subject: "savings_withdrawal",
    icon: HandCoins,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder(fetchSavingsWithdrawalPayload, buildSavingsWithdrawalSlipDoc),
  },
  {
    id: "time_deposit_maturity_notice",
    title: PRINTABLE_TITLES.time_deposit_maturity_notice,
    description: "The maturity date, the amount due and what happens at maturity.",
    subject: "time_deposit",
    icon: BellRing,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder((id) => fetchTimeDepositPayload(id, false), buildTimeDepositMaturityNoticeDoc),
  },
  {
    id: "time_deposit_early_termination",
    title: PRINTABLE_TITLES.time_deposit_early_termination,
    description: "The request to end a time deposit early, with today's figures from the server.",
    subject: "time_deposit",
    icon: TimerOff,
    ...SAVINGS_DOCUMENT,
    build: printableBuilder((id) => fetchTimeDepositPayload(id, true), buildTimeDepositEarlyTerminationDoc),
  },
];

/**
 * The documents this user may open: their module is switched on for this
 * deployment, and they hold any extra permission the document's data needs.
 */
export function visiblePrintables(can: (permission: Permission) => boolean): PrintableDefinition[] {
  return PRINTABLE_CATALOG.filter((p) => p.available !== false && (!p.permission || can(p.permission)));
}

/** Catalog lookup by id, for the detail route. */
export function findPrintable(id: string | undefined): PrintableDefinition | undefined {
  return PRINTABLE_CATALOG.find((p) => p.id === id);
}
