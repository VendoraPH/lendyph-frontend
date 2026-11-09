/**
 * What Lendy posts for each lending event, in plain words.
 *
 * This is documentation, not data: the server writes every journal, and this
 * describes what it posts. Accounts are named as the default chart names them;
 * the organisation's account mapping picks the real account. Interest and
 * penalty are on a cash basis, so they reach the books only when collected.
 */

export interface PostingRule {
  event: string;
  /** Accounts debited, in the order the journal lists them. */
  debit: readonly string[];
  /** Accounts credited, in the order the journal lists them. */
  credit: readonly string[];
  note: string;
}

/** The money account a method settles to. */
const MONEY_ACCOUNT = "Cash on Hand, GCash, Maya or Bank Accounts, by the method";

export const POSTING_RULES: readonly PostingRule[] = [
  {
    event: "Loan released",
    debit: ["Loans Receivable"],
    credit: [
      `The method's money account (the net proceeds)`,
      "Each deduction's own account",
    ],
    note: `The money account is ${MONEY_ACCOUNT}. Releasing a loan is not an expense: a receivable of the full principal takes the money's place. Each deduction withheld at release goes to the account mapped for its type: Processing Fee to Loan Processing Fee Income, Service Fee to Service Fee Income, Notarial Fee to Notarial Fees Payable, Insurance Premium to Insurance Premium Payable, Share Capital to Share Capital, Documentary Stamp Tax to Documentary Stamp Tax Payable, other taxes to Other Taxes Payable, and catalog fees to Other Fee Income. A deduction with no type stays on Loan Processing Fee Income.`,
  },
  {
    event: "Payment collected",
    debit: ["The method's money account"],
    credit: [
      "Loans Receivable (principal)",
      "Interest Income",
      "Penalty Income",
      "Insurance Premium Payable (premium owed)",
      "Share Capital (build-up)",
      "Other Liabilities (overpayment)",
    ],
    note: "Split exactly as the loan module allocated the payment; accounting never works out the split again. On a restructured loan, the same journal also moves part of the unearned interest and penalty into Interest Income and Penalty Income, in step with the principal collected.",
  },
  {
    event: "Restructure released",
    debit: ["Loans Receivable (the new loan's principal)", "The method's money account (the deductions)"],
    credit: [
      "Loans Receivable (principal carried from the old loan)",
      "Unearned Interest and Penalty – Restructured Loans (interest and penalty capitalised)",
      "Each deduction's own account",
    ],
    note: "No money changes hands for the principal, so nothing is paid out: the old loan's principal is carried into the new one. The deductions are collected from the member at release. The capitalised interest and penalty wait in the unearned account until the new loan's principal is collected. Whatever unearned interest and penalty the old loan has left after its write-off carries to the new loan, and is recognised the same way.",
  },
  {
    event: "Restructure: principal written off",
    debit: [
      "Unearned Interest and Penalty – Restructured Loans",
      "Allowance for Credit Losses",
      "Credit Loss Expense",
    ],
    credit: ["Loans Receivable"],
    note: "When the new loan covers less than the old loan's principal, the rest is written off on the old loan: first against its own unearned interest and penalty, then against the allowance, then as an expense.",
  },
  {
    event: "Balance adjustment",
    debit: [
      "Loan Adjustments Clearing (a reduction)",
      "Unearned Interest and Penalty – Restructured Loans (a reduction's matching share)",
      "Loans Receivable (an increase)",
    ],
    credit: [
      "Loans Receivable (a reduction)",
      "Loan Adjustments Clearing (the matching share)",
      "Loan Adjustments Clearing (an increase)",
    ],
    note: "An approved adjustment moves principal through Loan Adjustments Clearing. A reduction on a loan holding unearned interest and penalty also clears its matching share of it, in proportion to the principal reduced, into the clearing account; a reduction that completes the loan clears all of it. An increase clears nothing. Any balance left in Loan Adjustments Clearing needs review by the accountant.",
  },
  {
    event: "Share capital entry",
    debit: ["The method's money account"],
    credit: ["Share Capital"],
    note: "A withdrawal posts the reverse: Share Capital is debited and the money account credited.",
  },
  {
    event: "GCash Cash In",
    debit: ["Cash on Hand (the amount and the charge)"],
    credit: ["GCash (the amount)", "GCash Service Income (the charge)"],
    note: "Posted when the Cash In is marked paid. A ₱0.00 charge posts no service income line.",
  },
  {
    event: "GCash Cash Out",
    debit: ["GCash (the amount)"],
    credit: ["Cash on Hand (the amount less the charge)", "GCash Service Income (the charge)"],
    note: "Posted when the Cash Out is created, which completes it. A ₱0.00 charge posts no service income line.",
  },
  {
    event: "Allowance for credit losses",
    debit: ["Credit Loss Expense"],
    credit: ["Allowance for Credit Losses"],
    note: "Posted by someone with permission to book the allowance; lowering it posts the reverse. The allowance reduces net loans receivable without touching what a member still owes. A write-off takes principal only. A restructure write-off uses the old loan's own unearned interest and penalty first, then the allowance, then Credit Loss Expense.",
  },
  {
    event: "Payment voided",
    debit: ["Each account the payment credited"],
    credit: ["Each account the payment debited"],
    note: "A void reverses the payment's journal, line for line, so the books return to where they were before the payment.",
  },
];

/** Events that post nothing, because interest and penalty are on a cash basis. */
export const NOTHING_POSTS = {
  title: "Nothing posts (cash basis)",
  events: [
    "Interest falls due",
    "A penalty is charged",
    "A penalty is waived",
    "Extension interest is deferred",
  ],
  note: "Interest and penalty reach the books only when they are collected, as Interest Income and Penalty Income on the payment.",
} as const;
