// Payload helpers for POST /loans/{loan}/restructure, and where a restructured
// loan's balance went.
//
// The endpoint accepts the terms and deductions the user configured on the form
// rather than re-deriving them from the loan product, so these helpers keep the
// created loan matching the amortization preview the user just approved.

import { isEverReleasedLoanStatus } from "@/constants/loan-status";
import { currencyOrDash, toNumber } from "@/lib/report-format";

export type LoanDeductionType = "fixed" | "percentage";

export interface LoanDeduction {
  name: string;
  /** Percent of principal when `type` is "percentage"; peso amount when "fixed". */
  amount: number;
  type: LoanDeductionType;
}

/** A free-form deduction row as held by the form (amounts are raw input strings). */
export interface OtherDeductionInput {
  name: string;
  amount: string;
}

export const PROCESSING_FEE_LABEL = "Processing Fee";
export const SERVICE_FEE_LABEL = "Service Fee";
export const NOTARIAL_FEE_LABEL = "Notarial Fee";
export const OTHER_DEDUCTION_LABEL = "Other Deduction";

/**
 * Flatten the form's fee inputs into the API's `deductions[]` shape.
 * Zero/blank rows are dropped — a 0% fee is not a deduction — and an unnamed
 * custom row falls back to a generic label so the API never gets a blank name.
 *
 * `carried` are items the form shows but has no field for (a product's
 * notarial fee), sent as they are after the two fees: the order
 * `LoanService::createLoan()` itself adds the product's fees in.
 */
export function buildLoanDeductions({
  processingFeePercent,
  serviceFeePercent,
  otherDeductions,
  carried = [],
}: {
  processingFeePercent: number;
  serviceFeePercent: number;
  otherDeductions: OtherDeductionInput[];
  carried?: LoanDeduction[];
}): LoanDeduction[] {
  const deductions: LoanDeduction[] = [];

  if (processingFeePercent > 0) {
    deductions.push({
      name: PROCESSING_FEE_LABEL,
      amount: processingFeePercent,
      type: "percentage",
    });
  }

  if (serviceFeePercent > 0) {
    deductions.push({
      name: SERVICE_FEE_LABEL,
      amount: serviceFeePercent,
      type: "percentage",
    });
  }

  deductions.push(...carried);

  for (const row of otherDeductions) {
    const amount = parseFloat(row.amount) || 0;
    if (amount <= 0) continue;
    deductions.push({
      name: row.name.trim() || OTHER_DEDUCTION_LABEL,
      amount,
      type: "fixed",
    });
  }

  return deductions;
}

/**
 * What a restructure starts from and measures its shortfall against: the
 * server's `restructurable_balance`, from the loan summary or, when that read
 * failed, the loan. It leaves out the insurance premium owed, which a
 * restructure carries to the new loan instead. Null when neither sent it:
 * never the outstanding balance (premium included) or the principal.
 */
export function readRestructurableBalance(
  summary: { restructurable_balance?: unknown; [key: string]: unknown } | null,
  loan: { restructurable_balance?: unknown; [key: string]: unknown } | null,
): number | null {
  for (const raw of [summary?.restructurable_balance, loan?.restructurable_balance]) {
    if (typeof raw === "number" || typeof raw === "string") {
      const value = toNumber(raw);
      if (value !== null) return value;
    }
  }
  return null;
}

/**
 * The `restructure` section of `POST /loans/preview`, sent when the request
 * named a `source_loan_id` (decision 8a). Built by the server with the rule
 * the restructure itself applies (`LoanService::assertRestructureInvariants`).
 * Figures may arrive as numbers or decimal strings.
 */
export interface RestructurePreview {
  restructurable_balance?: number | string | null;
  principal?: number | string | null;
  /** How far the principal falls short of the restructurable balance: debt written off. */
  shortfall?: number | string | null;
  /** True when the shortfall needs remarks (the restructure refuses it without). */
  remarks_required?: boolean | null;
  /** True when the shortfall needs the Loans: Write off permission. */
  write_off_permission_required?: boolean | null;
}

/** The restructure section as the page shows it. Null means the server sent no figure: a dash. */
export interface RestructureShortfallView {
  restructurableBalance: number | null;
  principal: number | null;
  shortfall: number | null;
  remarksRequired: boolean | null;
  writeOffPermissionRequired: boolean | null;
}

function figure(raw: unknown): number | null {
  return typeof raw === "number" || typeof raw === "string" ? toNumber(raw) : null;
}

function flag(raw: unknown): boolean | null {
  return typeof raw === "boolean" ? raw : null;
}

/**
 * The server's restructure figures (a `RestructurePreview`), read as sent and
 * checked, since they come off the wire. Nothing is subtracted here:
 * the browser used to work the shortfall out as balance minus principal, which
 * could drift from the server's rule (rounding, or a balance that moved since
 * the page loaded). A missing or unreadable figure is null, never 0.
 */
export function readRestructurePreview(raw: unknown): RestructureShortfallView {
  const section: Record<string, unknown> = raw && typeof raw === "object" ? { ...raw } : {};
  return {
    restructurableBalance: figure(section.restructurable_balance),
    principal: figure(section.principal),
    shortfall: figure(section.shortfall),
    remarksRequired: flag(section.remarks_required),
    writeOffPermissionRequired: flag(section.write_off_permission_required),
  };
}

/**
 * The restructurable balance the amount hint quotes: the preview's, which is
 * the server's figure for the terms on screen, with the loan summary's (read
 * when the loan was picked) only until the preview has one. Null with neither.
 */
export function restructurableBalanceShown(
  restructure: RestructureShortfallView,
  summaryBalance: number | null,
): number | null {
  return restructure.restructurableBalance ?? summaryBalance;
}

/**
 * Whether the user holds Loans: Write off (`loans:write_off`), which the
 * restructure needs to take a principal below the restructurable balance.
 * Read from the permission list by name: the shared `Permission` type does
 * not list the `write_off` action, though the backend seeds it.
 */
export function holdsWriteOff(permissions: readonly string[]): boolean {
  return permissions.includes("loans:write_off");
}

/** What the restructure page shows and requires for the server's shortfall. */
export interface RestructureShortfallState {
  /** The shortfall notice and the "remarks required" hint are shown. */
  showsShortfall: boolean;
  /** Submit needs remarks. */
  remarksRequired: boolean;
  /**
   * The restructure writes debt off, which needs Loans: Write off, and this
   * user doesn't hold it: the server would refuse it, so Submit is blocked.
   */
  blockedByWriteOff: boolean;
}

/**
 * The server's shortfall flags as the page applies them. Each is a presence
 * check, never arithmetic: nothing applies until a principal above 0 is
 * entered (the preview names no source loan before then), and
 * `write_off_permission_required` states what the restructure needs, so it
 * blocks only a user without `loans:write_off`.
 */
export function restructureShortfallState(
  principal: number,
  restructure: RestructureShortfallView,
  canWriteOff: boolean,
): RestructureShortfallState {
  const applies = principal > 0;
  const remarksRequired = applies && restructure.remarksRequired === true;
  return {
    showsShortfall: remarksRequired,
    remarksRequired,
    blockedByWriteOff: applies && restructure.writeOffPermissionRequired === true && !canWriteOff,
  };
}

/**
 * Why a user without Loans: Write off can't restructure for less, in the
 * server's own wording (`LoanService::assertRestructureInvariants`), quoting
 * the balance to restructure instead: the preview's, else the summary's, else
 * a dash.
 */
export function writeOffNotice(
  restructure: RestructureShortfallView,
  summaryBalance: number | null,
): string {
  const balance = currencyOrDash(restructurableBalanceShown(restructure, summaryBalance));
  return (
    "Writing off part of the balance requires the Loans: Write off permission. " +
    `Restructure the full restructurable balance of ${balance} instead.`
  );
}

export interface RestructureSubmitInputs {
  previewStatus: "idle" | "loading" | "ready" | "error";
  principal: number;
  restructure: RestructureShortfallView;
  remarks: string;
  canWriteOff: boolean;
  /** The loan summary's restructurable balance, for the write-off notice's fallback. */
  summaryBalance?: number | null;
}

export interface RestructureSubmitCheck {
  /** Set while the preview's figures are loading: Submit waits, saying this. */
  wait: string | null;
  /** Fields still to complete, for the validation pop-up. */
  missing: string[];
  /** Set when the write-off is one the user can't make: Submit is blocked, saying this. */
  writeOff: string | null;
}

/**
 * Whether Submit may go ahead, on the server's figures. It waits while the
 * preview loads, since the shortfall and its requirements aren't known yet. A
 * failed preview blocks nothing: the restructure applies the same rule and
 * refuses with its own message.
 */
export function restructureSubmitCheck(inputs: RestructureSubmitInputs): RestructureSubmitCheck {
  if (inputs.previewStatus === "loading") {
    return {
      wait: "The loan figures are still loading. Submit again once they appear.",
      missing: [],
      writeOff: null,
    };
  }
  const state = restructureShortfallState(inputs.principal, inputs.restructure, inputs.canWriteOff);
  return {
    wait: null,
    missing: state.remarksRequired && !inputs.remarks.trim() ? ["Remarks"] : [],
    writeOff: state.blockedByWriteOff
      ? writeOffNotice(inputs.restructure, inputs.summaryBalance ?? null)
      : null,
  };
}

/**
 * The loan a restructure moved this loan's balance to: the entry of its
 * `restructured_into` that was released. That list holds every restructure
 * application raised on the loan, and a rejected or voided one never took the
 * balance, so only a released child is the loan the balance went to. Null when
 * there is none.
 */
export function restructureSuccessor<T extends { status?: unknown }>(
  restructuredInto: readonly T[] | null | undefined,
): T | null {
  return (
    restructuredInto?.find(
      (child) => typeof child.status === "string" && isEverReleasedLoanStatus(child.status),
    ) ?? null
  );
}
