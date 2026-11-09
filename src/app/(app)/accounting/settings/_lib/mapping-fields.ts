import { getErrorMessage } from "@/lib/api-error";
import type { Account, AccountMapping, AccountType } from "@/types";

export interface MappingField {
  key: keyof AccountMapping;
  label: string;
  hint: string;
  /** Which account types may fill this role. */
  types: AccountType[];
  /** True when only a money account makes sense. */
  moneyOnly?: boolean;
  /** Account codes the server refuses for this role. */
  excludedCodes?: string[];
}

/** 3050 Opening Balance Equity, as the server's opening balance poster names it. */
export const OPENING_BALANCE_EQUITY_CODE = "3050";

/**
 * Every role the posting engine resolves, grouped the way an operator thinks.
 *
 * These are settings rather than constants because organisations genuinely
 * differ — a cooperative books membership fees somewhere a lending corporation
 * does not — and because a wrong default that cannot be corrected would
 * silently misstate income for as long as nobody noticed.
 */
export const GROUPS: { title: string; description: string; fields: MappingField[] }[] = [
  {
    title: "Where money is held",
    description: "Which account each settlement method debits or credits.",
    fields: [
      { key: "cash", label: "Cash", hint: "Collections taken in cash.", types: ["asset"], moneyOnly: true },
      { key: "bank", label: "Bank", hint: "Bank deposits and withdrawals.", types: ["asset"], moneyOnly: true },
      { key: "gcash", label: "GCash", hint: "GCash wallet balance.", types: ["asset"], moneyOnly: true },
      { key: "maya", label: "Maya", hint: "Maya wallet balance.", types: ["asset"], moneyOnly: true },
    ],
  },
  {
    title: "What members owe",
    description: "The receivables a release and its charges create.",
    fields: [
      {
        key: "loans_receivable",
        label: "Loans receivable",
        hint: "Principal outstanding. Debited on release, credited on collection.",
        types: ["asset"],
      },
      {
        key: "interest_receivable",
        label: "Interest receivable",
        hint: "Interest earned but not yet collected.",
        types: ["asset"],
      },
      {
        key: "penalty_receivable",
        label: "Penalty receivable",
        hint: "Penalties charged but not yet collected.",
        types: ["asset"],
      },
      {
        key: "loan_adjustments",
        label: "Loan adjustments clearing",
        hint: "Where an approved balance adjustment is cleared against loans receivable. It should read zero once each adjustment is reviewed.",
        types: ["asset"],
      },
      {
        key: "unearned_restructure_income",
        label: "Unearned restructure interest and penalty",
        hint: "A contra-asset. Interest and penalty a restructure added to the new loan's principal, earned as that principal is collected.",
        types: ["asset"],
      },
    ],
  },
  {
    title: "What the business earns",
    description: "Where each kind of income is recognised.",
    fields: [
      { key: "interest_income", label: "Interest income", hint: "Interest on loans.", types: ["income"] },
      { key: "penalty_income", label: "Penalty income", hint: "Late-payment penalties.", types: ["income"] },
      {
        key: "processing_fee_income",
        label: "Processing fee income",
        hint: "Processing fees, fees charged at collection, and any release deduction without an account below.",
        types: ["income"],
      },
      {
        key: "gcash_service_income",
        label: "GCash service income",
        hint: "The charge on a GCash Cash In or Cash Out.",
        types: ["income"],
      },
    ],
  },
  {
    title: "Release deductions",
    description: "Where each deduction withheld at release is credited, by type.",
    fields: [
      {
        key: "service_fee_income",
        label: "Service fee income",
        hint: "Service fees withheld at release.",
        types: ["income"],
      },
      {
        key: "notarial_fees_payable",
        label: "Notarial fees payable",
        hint: "Notarial fees withheld at release, owed to the notary until paid over.",
        types: ["liability"],
      },
      {
        key: "insurance_premium_payable",
        label: "Insurance premium payable",
        hint: "Insurance premiums withheld at release or collected later from payments, owed to the insurer until remitted.",
        types: ["liability"],
      },
      {
        key: "share_capital",
        label: "Share capital",
        hint: "Share capital a member pays through a release deduction.",
        types: ["equity"],
      },
      {
        key: "other_fee_income",
        label: "Other fee income",
        hint: "Other configured fees (Settings → Fees) withheld at release.",
        types: ["income"],
      },
    ],
  },
  {
    title: "Taxes withheld at release",
    description:
      "Where each tax withheld at release is credited. Taxes are owed to the government until remitted, never income.",
    fields: [
      {
        key: "documentary_stamp_tax_payable",
        label: "Documentary stamp tax payable",
        hint: "Documentary stamp tax (DST) withheld at release. Without an account here it posts to other taxes payable.",
        types: ["liability"],
      },
      {
        key: "withholding_tax_payable",
        label: "Withholding tax payable",
        hint: "Withholding tax withheld at release. Without an account here it posts to other taxes payable.",
        types: ["liability"],
      },
      {
        key: "other_taxes_payable",
        label: "Other taxes payable",
        hint: "Any other tax withheld at release.",
        types: ["liability"],
      },
    ],
  },
  {
    title: "Credit losses and payables",
    description: "Provisioning and what the business owes others.",
    fields: [
      {
        key: "credit_loss_expense",
        label: "Credit loss expense",
        hint: "The cost side of a provision.",
        types: ["expense"],
      },
      {
        key: "allowance_credit_losses",
        label: "Allowance for credit losses",
        hint: "A contra-asset. It reduces net receivables without changing what a member owes.",
        types: ["asset"],
      },
      {
        key: "accounts_payable",
        label: "Accounts payable",
        hint: "Expenses recorded but not yet paid.",
        types: ["liability"],
      },
      {
        key: "borrower_advances",
        label: "Member advances",
        hint: "Money received beyond what was due. Held on the member's behalf until it is applied or refunded — never income.",
        types: ["liability"],
      },
      {
        key: "suspense",
        label: "Suspense",
        hint: "Money received that cannot be identified yet. Held until it is, never income.",
        types: ["liability"],
      },
    ],
  },
  {
    title: "Year-end close",
    description: "Where the year's result is moved when the books are closed.",
    fields: [
      {
        key: "net_surplus",
        label: "Retained earnings or net surplus",
        hint: "Retained Earnings on a company chart, Undivided Net Surplus on a cooperative's. Never 3050 Opening Balance Equity.",
        types: ["equity"],
        // The server refuses it: the year's result would mix into the opening balances.
        excludedCodes: [OPENING_BALANCE_EQUITY_CODE],
      },
    ],
  },
];

/** The accounts a role may resolve to: its types, money accounts where it needs one, never a refused code. */
export function accountsForField(field: MappingField, accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      field.types.includes(account.type) &&
      (!field.moneyOnly || Boolean(account.cash_kind)) &&
      !field.excludedCodes?.includes(account.code),
  );
}

/** A refused save in the server's words, for example a 422 on `net_surplus`. */
export function saveFailureMessage(err: unknown): string {
  return getErrorMessage(err, "Could not save these settings.");
}
