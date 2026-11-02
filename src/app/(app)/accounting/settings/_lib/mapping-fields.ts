import type { AccountMapping, AccountType } from "@/types";

export interface MappingField {
  key: keyof AccountMapping;
  label: string;
  hint: string;
  /** Which account types may fill this role. */
  types: AccountType[];
  /** True when only a money account makes sense. */
  moneyOnly?: boolean;
}

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
    title: "What borrowers owe",
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
        hint: "A contra-asset. It reduces net receivables without changing what a borrower owes.",
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
        label: "Borrower advances",
        hint: "Money received beyond what was due. Held on the borrower's behalf until it is applied or refunded — never income.",
        types: ["liability"],
      },
    ],
  },
];
