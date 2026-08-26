/**
 * Printable document model — the contract every template builds and the
 * renderer consumes.
 *
 * Deliberately mirrors the split that already works for reports
 * (`src/app/(app)/reports/_lib/`): templates are pure `payload -> document`
 * functions with no notion of a session, a logo or the DOM, so the whole
 * API-to-paper contract is unit-testable without a browser. Only
 * `print-render.ts` knows about HTML and only `print-open.ts` knows about
 * `window`.
 *
 * The report `ReportSection` union is NOT reused here. A report is a grid of
 * figures; a disclosure statement is prose, a charges stack, a signature grid
 * and a notarial block. Forcing one union to cover both would make every
 * template carry fields it does not use.
 */

/** Every document the catalog can produce. */
export type PrintableId =
  | "disclosure_statement"
  | "promissory_note"
  | "official_receipt"
  | "release_voucher"
  | "demand_letter"
  | "amortization_schedule"
  | "share_capital_certificate"
  | "member_ledger_card";

/**
 * What a template needs picked before it can run. Mirrors the reports'
 * `ReportSubject`, extended with the repayment a receipt is printed from.
 */
export type PrintableSubject = "loan" | "borrower" | "repayment";

/**
 * Letterhead identity.
 *
 * Lendyph is single-tenant-per-deployment, so this is the one cooperative the
 * instance belongs to — resolved at build time from branding settings, never
 * hardcoded. `name` falling back to `siteConfig.name` is the renderer's job,
 * not the template's.
 */
export interface PrintableOrg {
  name: string;
  logoUrl: string | null;
  address?: string | null;
  contact?: string | null;
  /** Branch the document was issued by, when the subject has one. */
  branchLabel?: string | null;
}

export type PrintAlign = "left" | "right" | "center";

/** Reuses the reports' formatter vocabulary so a peso prints the same way. */
export type PrintFormat =
  | "text"
  | "currency"
  | "number"
  | "percent"
  | "date"
  | "datetime";

export interface PrintColumn {
  key: string;
  header: string;
  align?: PrintAlign;
  format?: PrintFormat;
  /** Column width as a CSS value, e.g. "12%" or "80pt". */
  width?: string;
}

/** A label→value row. `underline` renders a rule to be filled in by hand. */
export interface PrintField {
  label: string;
  value?: string;
  underline?: boolean;
}

/**
 * One line of a charges stack. `rule` draws the accounting rule above it:
 * `total` a single line, `grand` a double line.
 */
export interface PrintChargeLine {
  label: string;
  amount: string;
  rule?: "total" | "grand";
  /** Indented sub-item, e.g. an individual deduction under Less: Deductions. */
  indent?: boolean;
}

export interface PrintSignature {
  /** Printed under the rule. Omitted when the signatory is not yet known. */
  name?: string | null;
  /** Role, e.g. "Borrower", "Approved by". Always present. */
  label: string;
  /** Small print under the name — a date line, an ID, a position. */
  detail?: string | null;
}

export type PrintBlock =
  /** Document title, directly under the letterhead. */
  | { kind: "title"; text: string; subtitle?: string; legalRef?: string }
  /** Section heading with no body — separates a long document. */
  | { kind: "heading"; text: string }
  | {
      kind: "fields";
      title?: string;
      items: PrintField[];
      /** 1 for a stacked list, 2 for a side-by-side grid. Defaults to 1. */
      columns?: 1 | 2;
    }
  /**
   * Prose. `html` is authored by a template in this repo, never taken from an
   * API payload — interpolated values must be escaped by the template.
   */
  | { kind: "paragraph"; html: string; align?: PrintAlign }
  | {
      kind: "table";
      title?: string;
      columns: PrintColumn[];
      rows: Record<string, unknown>[];
      /** Footer row, keyed by column. Values are pre-formatted strings. */
      totals?: Record<string, string>;
      emptyText?: string;
    }
  | { kind: "charges"; title?: string; lines: PrintChargeLine[] }
  | {
      kind: "signatures";
      title?: string;
      blocks: PrintSignature[];
      columns?: 2 | 3;
    }
  /** Jurat / acknowledgment, incl. the Doc/Page/Book/Series footer. */
  | { kind: "notarial"; body: string }
  /** Small-print aside: an instruction, a disclaimer, a validity note. */
  | { kind: "note"; text: string }
  | { kind: "spacer"; height?: string }
  | { kind: "page_break" };

export interface PrintableDocument {
  id: PrintableId;
  org: PrintableOrg;
  title: string;
  /**
   * Quotable document reference, e.g. `OR-20260826-0142`. Built by
   * `print-chrome`, not by the template.
   */
  reference?: string | null;
  generatedAt: string;
  /**
   * Labelled copies of the same body, e.g.
   * `["Borrower's Copy", "File Copy"]`. Each is repeated on its own page with
   * the label in the corner. Omitted or a single entry prints one copy with no
   * label.
   */
  copies?: string[];
  blocks: PrintBlock[];
  /** Replaces the default "system-generated document" footer line. */
  footerNote?: string;
  /**
   * The record this document was to be built from could not be read, so the
   * figures on it are blanks rather than values.
   *
   * Failing soft to a blank form is right for the documents that *ask* — a
   * disclosure, a note, a voucher, a schedule are all things a branch can print
   * and complete by hand when the API is unreachable. It is wrong for the two
   * that *assert*: an official receipt and a share capital certificate state a
   * figure as fact over a signature line, and a receipt reading
   * "TOTAL AMOUNT PAID ₱0.00 / Zero Pesos" above a Received-by rule is a false
   * statement, not a form.
   *
   * Those templates therefore blank the figures, drop the certifying clause and
   * set this. Callers surface it as a warning rather than a success — the paper
   * says the same thing, but nobody should have to notice.
   */
  incomplete?: boolean;
}

/** Everything a template can vary. Mirrors the reports' `ReportContext`. */
export interface PrintableContext {
  /** Id of the loan, borrower, or repayment the document is about. */
  subjectId: number;
  org: PrintableOrg;
}

export interface PrintableDefinition {
  id: PrintableId;
  title: string;
  description: string;
  subject: PrintableSubject;
  /** lucide-react icon, as in `REPORT_CATALOG`. */
  icon: import("lucide-react").LucideIcon;
  /**
   * Fetch + map. Fails soft the way report builders do: a rejected request
   * still yields a document, with blanks where the data would have been, so a
   * form can always be printed and completed by hand.
   */
  build: (ctx: PrintableContext) => Promise<PrintableDocument>;
}

export const SUBJECT_META: Record<
  PrintableSubject,
  { label: string; placeholder: string }
> = {
  loan: { label: "Loan", placeholder: "Search loan or borrower…" },
  borrower: { label: "Member", placeholder: "Search member…" },
  repayment: { label: "Payment", placeholder: "Search receipt number…" },
};
