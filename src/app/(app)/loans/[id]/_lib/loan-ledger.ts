/**
 * The loan page's Ledger, read from GET /loans/{id}/ledger. Every figure and
 * running balance is the server's; nothing is added up or walked here.
 *
 * A row states its own principal, interest, penalty and build-up figures and
 * the balances after it. Payment, void and charge rows state positive amounts
 * and their `kind` says which way they move the balances; an `adjustment`
 * row's figures are the signed change it made (negative lowers). So each
 * figure goes in the Debit column (raises what is owed) or the Credit column
 * (lowers it) by its kind, an adjustment's by its sign. The balances leave out
 * the insurance premium owed, which payment rows show in their own column; a
 * void row's premium is the premium put back, not collected again.
 *
 * A figure the server did not send is null (a dash on screen); 0 stays 0.
 * Pure, so it runs under `tsx --test`.
 */
import { toNumber } from "@/lib/report-format";
import { repaymentRefNo } from "./ledger-rows";

export interface LedgerCell {
  /** Raises what is owed. */
  debit: number | null;
  /** Lowers what is owed. */
  credit: number | null;
}

export interface LedgerBalancesView {
  principal: number | null;
  interest: number | null;
  penalty: number | null;
  scb: number | null;
}

export interface LedgerViewRow {
  key: string;
  date: string | null;
  kind: string;
  label: string;
  description: string;
  repaymentId: number | null;
  principal: LedgerCell;
  interest: LedgerCell;
  penalty: LedgerCell;
  scb: LedgerCell;
  /**
   * The insurance premium a payment collected, or on a void row the premium
   * put back (`restored`).
   */
  insurance: { amount: number | null; restored: boolean };
  balances: LedgerBalancesView;
}

export interface LedgerView {
  rows: LedgerViewRow[];
  closing: LedgerBalancesView;
}

const KIND_LABELS: Record<string, string> = {
  release: "Loan released",
  repayment: "Payment",
  extension_payment: "Extension payment",
  extension_charge: "Extension interest charged",
  penalty_charge: "Penalty charged",
  adjustment: "Adjustment",
  void: "Payment voided",
};

/** Kinds whose positive figures raise what is owed. */
const RAISES = new Set(["release", "extension_charge", "penalty_charge", "void"]);
/** Kinds whose positive figures lower what is owed. */
const LOWERS = new Set(["repayment", "extension_payment"]);
/** Kinds that record a payment (and so name the repayment it was). */
const PAYMENTS = new Set(["repayment", "extension_payment"]);

/** A ledger kind in plain words; a kind added later reads as words too. */
export function ledgerKindLabel(kind: string): string {
  const known = KIND_LABELS[kind];
  if (known) return known;
  const words = kind.replace(/_/g, " ").trim();
  return words === "" ? "Entry" : words.charAt(0).toUpperCase() + words.slice(1);
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function figure(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  return toNumber(raw);
}

function idOrNull(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) ? raw : null;
}

/** Which column a row's figure goes in: by its kind, an adjustment's (or an unknown kind's) by its sign. */
function cell(kind: string, value: number | null): LedgerCell {
  if (value === null) return { debit: null, credit: null };
  if (RAISES.has(kind)) return { debit: value, credit: null };
  if (LOWERS.has(kind)) return { debit: null, credit: value };
  return value < 0 ? { debit: null, credit: -value } : { debit: value, credit: null };
}

function balancesOf(raw: unknown): LedgerBalancesView {
  const b = record(raw);
  return {
    principal: figure(b?.principal),
    interest: figure(b?.interest),
    penalty: figure(b?.penalty),
    scb: figure(b?.scb),
  };
}

/** The server's ledger, row by row, or null when the answer has no rows list. */
export function readLoanLedger(raw: unknown): LedgerView | null {
  const data = record(raw);
  if (!data || !Array.isArray(data.rows)) return null;
  const rows = data.rows.map((entry, index): LedgerViewRow => {
    const r = record(entry) ?? {};
    const kind = typeof r.kind === "string" ? r.kind : "";
    const repaymentId = idOrNull(r.repayment_id);
    const adjustmentId = idOrNull(r.loan_adjustment_id);
    return {
      key: `${index}-${kind}-${repaymentId ?? adjustmentId ?? ""}`,
      date: typeof r.date === "string" ? r.date : null,
      kind,
      label: ledgerKindLabel(kind),
      description: typeof r.description === "string" ? r.description : "",
      repaymentId,
      principal: cell(kind, figure(r.principal)),
      interest: cell(kind, figure(r.interest)),
      penalty: cell(kind, figure(r.penalty)),
      scb: cell(kind, figure(r.scb)),
      insurance: { amount: figure(r.insurance), restored: kind === "void" },
      balances: balancesOf(r.balances),
    };
  });
  return { rows, closing: balancesOf(data.closing) };
}

/**
 * Whether the Ledger shows the build-up columns: when the schedule does
 * (`scheduleHasScb`), or when any row's build-up is not 0.
 */
export function ledgerShowsScb(scheduleHasScb: boolean, ledger: LedgerView | null): boolean {
  if (scheduleHasScb) return true;
  return (ledger?.rows ?? []).some(
    (row) => (row.scb.debit !== null && row.scb.debit !== 0) || (row.scb.credit !== null && row.scb.credit !== 0),
  );
}

/**
 * A row's description; a voided payment's drops the server's trailing
 * "(voided)", because the row's badge already says so.
 */
export function ledgerRowDescription(description: string, voided: boolean): string {
  return voided ? description.replace(/\s*\(voided\)\s*$/i, "") : description;
}

interface LedgerRepayment {
  id: number;
  receipt_number?: string | null;
  amount_paid?: unknown;
  status?: string;
}

/**
 * What a row shows of the payment it names: the receipt number, the amount
 * paid on a payment row, whether that payment was voided, and whether it can
 * be voided from here: a plain payment not yet voided, on a loan that isn't
 * restructured (the server refuses both an extension's payment and any
 * payment on a restructured loan). A dash and no Void without a loaded
 * payment.
 */
export function ledgerRowPayment(
  row: { kind: string; repaymentId: number | null },
  repayment: LedgerRepayment | undefined,
  loanStatus: string,
): { refNo: string; amountPaid: number | null; voided: boolean; canVoid: boolean } {
  if (row.repaymentId === null || repayment === undefined) {
    return { refNo: "—", amountPaid: null, voided: false, canVoid: false };
  }
  const isPayment = PAYMENTS.has(row.kind);
  const voided = isPayment && repayment.status === "voided";
  return {
    refNo: repaymentRefNo(repayment),
    amountPaid: isPayment ? figure(repayment.amount_paid) : null,
    voided,
    canVoid: row.kind === "repayment" && !voided && loanStatus !== "restructured",
  };
}
