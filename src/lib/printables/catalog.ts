import {
  BookUser,
  CalendarClock,
  FileSignature,
  FileText,
  Landmark,
  Receipt,
  ScrollText,
  Wallet,
} from "lucide-react";
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
 * A failed request must still produce a document.
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
    const raw = await fetcher(ctx.subjectId).catch(() => null);
    return build(raw, { org: ctx.org });
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
 * route 404s. It makes it a different document, so the response is normalised
 * here with a note of whether it may have been capped, and
 * `share-capital-certificate.ts` prints an extract rather than a certificate
 * when it was.
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

// ---------------------------------------------------------------------------
// Exported catalog
// ---------------------------------------------------------------------------

export const PRINTABLE_CATALOG: PrintableDefinition[] = [
  {
    id: "disclosure_statement",
    title: "Disclosure Statement",
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
    title: "Promissory Note",
    description:
      "The borrower's undertaking to pay, with co-maker clause and notarial block.",
    subject: "loan",
    icon: FileSignature,
    build: printableBuilder(
      (id) => loanDocumentService.promissoryNote(id),
      buildPromissoryNoteDoc
    ),
  },
  {
    id: "release_voucher",
    title: "Loan Release Voucher",
    description:
      "Principal, itemised deductions and net proceeds, signed on release.",
    subject: "loan",
    icon: Wallet,
    build: printableBuilder((id) => loanService.detail(id), buildReleaseVoucherDoc),
  },
  {
    id: "amortization_schedule",
    title: "Amortization Schedule",
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
    title: "Demand Letter",
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
    title: "Official Receipt",
    description:
      "Two copies — borrower's and file — with the payment's full application.",
    subject: "repayment",
    icon: Receipt,
    build: printableBuilder(
      (id) => repaymentService.detail(id),
      buildOfficialReceiptDoc
    ),
  },
  {
    id: "share_capital_certificate",
    title: "Share Capital Certificate",
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
    title: "Member Ledger Card",
    description: "Every loan account a member holds, with payments and balances.",
    subject: "borrower",
    icon: BookUser,
    build: printableBuilder(
      (id) => reportService.subsidiaryLedger(id),
      buildMemberLedgerCardDoc
    ),
  },
];

/** Catalog lookup by id, for the detail route. */
export function findPrintable(id: string | undefined): PrintableDefinition | undefined {
  return PRINTABLE_CATALOG.find((p) => p.id === id);
}
