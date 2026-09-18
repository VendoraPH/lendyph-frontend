/**
 * The automatic posting engine's rule set.
 *
 * A lending event happens → a rule fires → a balanced journal comes out. This
 * is what lets a loan officer work without knowing debits from credits.
 *
 * WHERE THIS RUNS. The authoritative posting is the backend's job: a journal
 * has to be written in the same transaction that commits the loan release or
 * the collection, or a crash between the two leaves the books disagreeing with
 * the portfolio. This module is the rule set expressed once, in a form that
 * can be unit-tested and that the UI can use to PREVIEW the entry an action
 * will produce.
 *
 * WHICH SIDE IS AUTHORITATIVE. `app/Services/Accounting/PostingRules.php` is.
 * This file used to say the backend must mirror it, and for `loan_release` and
 * `loan_collection` mirroring it exactly would have been wrong: the rules here
 * did not match what the backend does with money. It withholds fees at release
 * and it accepts a payment larger than the amount due. Both rules have been
 * brought back into agreement with it — see each `case` for what was wrong and
 * why it went unnoticed. Change the PHP first; change this to match.
 *
 * Two invariants hold for every rule here, and the tests assert both on every
 * shape: the result balances, and no zero-amount line is ever emitted. The two
 * rules that take figures sourced independently of each other assert a third —
 * that those figures reconcile — rather than emitting an entry built from
 * numbers that disagree.
 */

import { formatCentavos, sumCentavos } from "./money";
import type {
  AccountMapping,
  JournalSource,
  PaymentAllocation,
  SettlementMethod,
} from "@/types/accounting";

/** A generated line, before it has an id. */
export interface PostingLine {
  account_id: number;
  /** Centavos. */
  debit: number;
  credit: number;
}

export interface Posting {
  source: JournalSource;
  date: string;
  branch_id: number | null;
  reference: string | null;
  description: string;
  lines: PostingLine[];
}

interface BaseInput {
  date: string;
  branch_id: number | null;
  reference?: string | null;
}

export type PostingInput =
  | (BaseInput & {
      event: "loan_release";
      /** `loans.principal_amount` — the GROSS the borrower owes from day one. */
      amount: number;
      /** `loans.net_proceeds` — what actually left the drawer. */
      net: number;
      /** `loans.total_deductions` — what was withheld at release and kept. */
      deductions: number;
      method: SettlementMethod;
    })
  | (BaseInput & {
      event: "loan_collection";
      method: SettlementMethod;
      /**
       * `repayments.amount_paid` — every peso that arrived.
       *
       * Carried separately from the allocation rather than derived from it,
       * exactly as the backend carries it, because the two are sourced
       * independently: the split comes from the loan engine and this comes from
       * what the payer handed over. Deriving it would make the reconciliation
       * check below vacuous, and a preview that cannot disagree with the
       * backend is a preview that cannot warn about anything.
       */
      received: number;
      allocation: PaymentAllocation;
    })
  | (BaseInput & {
      event: "fund_transfer";
      amount: number;
      from: SettlementMethod;
      to: SettlementMethod;
    })
  | (BaseInput & {
      event: "wallet_charge";
      amount: number;
      method: SettlementMethod;
      expense_account_id: number;
    })
  | (BaseInput & {
      event: "expense_cash";
      amount: number;
      expense_account_id: number;
      method: SettlementMethod;
    })
  | (BaseInput & {
      event: "expense_accrual";
      amount: number;
      expense_account_id: number;
    })
  | (BaseInput & {
      event: "payable_payment";
      amount: number;
      method: SettlementMethod;
    })
  | (BaseInput & { event: "loan_fee"; amount: number; method: SettlementMethod })
  | (BaseInput & { event: "credit_loss_provision"; amount: number });

/** Which asset account a settlement method touches. */
export function settlementAccountId(
  method: SettlementMethod,
  mapping: AccountMapping
): number {
  return mapping[method];
}

/**
 * Guards the money coming in.
 *
 * Non-integers are refused outright rather than rounded: every amount reaching
 * this module has already been through `toCentavos`, so a fractional value
 * means a caller divided somewhere it should not have, and silently rounding
 * would bury that.
 */
function requireAmount(amount: number, what: string): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${what} must be greater than zero.`);
  }
  if (!Number.isInteger(amount)) {
    throw new Error(`${what} must be whole centavos, got ${amount}.`);
  }
  return amount;
}

/**
 * One PART of an amount that is split across several lines.
 *
 * Distinct from `requireAmount` because zero is legitimate here and nowhere
 * else: a collection with no penalty component is ordinary, and `used()` drops
 * the empty line further down. Everything else `requireAmount` rejects is
 * rejected identically.
 *
 * This exists because validating only the SUM is not validation. The old
 * `loan_collection` branch checked `sumCentavos([...])` and nothing else, so
 * `{ principal: 100.5, interest: 99.5 }` summed to a clean 200 and emitted two
 * lines carrying half a centavo each — amounts that cannot exist in the ledger
 * and that no later check would catch, because the entry balanced. Worse, a
 * NEGATIVE component passed unnoticed whenever the sum stayed positive:
 * `{ principal: 300, interest: -100 }` posted a 200 debit against a 300 credit
 * and a -100 credit, which balances arithmetically and is nonsense as
 * bookkeeping. This file is the spec the backend will mirror, so a gap here
 * does not stay in the frontend.
 */
function requireComponent(amount: number, what: string): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${what} cannot be negative.`);
  }
  if (!Number.isInteger(amount)) {
    throw new Error(`${what} must be whole centavos, got ${amount}.`);
  }
  return amount;
}

const debit = (account_id: number, amount: number): PostingLine => ({
  account_id,
  debit: amount,
  credit: 0,
});

const credit = (account_id: number, amount: number): PostingLine => ({
  account_id,
  debit: 0,
  credit: amount,
});

/** Drops zero legs so a payment without penalty emits no penalty line. */
const used = (lines: PostingLine[]): PostingLine[] =>
  lines.filter((l) => l.debit !== 0 || l.credit !== 0);

/**
 * Turns a lending event into a balanced journal.
 *
 * Throws on input that cannot produce a sensible entry — a zero amount, a
 * transfer to the same account. These are programming errors rather than user
 * input (the forms validate first), so they fail loudly.
 */
export function buildPosting(
  input: PostingInput,
  mapping: AccountMapping
): Posting {
  const base = {
    date: input.date,
    branch_id: input.branch_id,
    reference: input.reference ?? null,
  };

  switch (input.event) {
    /**
     * Money leaves a wallet and becomes an amount the borrower owes. The
     * business is no poorer — one asset has turned into another.
     *
     * ## The gross/net split, which is the whole point of this rule
     *
     * The borrower owes the FULL principal from day one — the amortisation
     * schedule is built on `principal_amount`, not on what they walked out
     * with — so loans receivable is debited with the GROSS.
     *
     * What actually left the drawer is `net_proceeds`. The backend withholds in
     * two places, `LoanService::computeDeductions()` (processing, service and
     * notarial fees) and `LoanService::applyInsuranceOnRelease()` (the insurance
     * premium), and the difference is income the organisation kept. This rule
     * credited the settlement account with the gross and emitted no fee leg at
     * all, which is only correct where nothing is withheld: cash came out
     * overstated by every peso deducted AND the fee income never appeared.
     * The entry still balanced, because both sides moved by the same amount,
     * which is exactly why nothing downstream ever surfaced it — two statements
     * wrong at once and both looking fine.
     *
     *     gross = net + deductions        (asserted, not assumed)
     *
     * The assertion is not ceremony. `net_proceeds` is maintained by repeated
     * float subtraction in pesos across two methods, and a CSV-imported or
     * hand-edited loan need not satisfy the identity at all. Naming the three
     * figures that disagree beats previewing an entry that cannot post.
     */
    case "loan_release": {
      const gross = requireAmount(input.amount, "A loan release");
      const net = requireComponent(input.net, "The net proceeds");
      const deductions = requireComponent(input.deductions, "The total deductions");

      if (net + deductions !== gross) {
        throw new Error(
          `This loan does not reconcile: ${formatCentavos(net)} disbursed plus ` +
            `${formatCentavos(deductions)} withheld is ${formatCentavos(net + deductions)}, ` +
            `but the principal is ${formatCentavos(gross)}.`
        );
      }

      return {
        ...base,
        source: "loan_release",
        description: "Loan release",
        lines: used([
          debit(mapping.loans_receivable, gross),
          credit(settlementAccountId(input.method, mapping), net),
          // Withheld at release and kept: income, recognised now. `used()`
          // drops it when nothing was deducted, which is the ordinary case for
          // a product with no fees.
          credit(mapping.processing_fee_income, deductions),
        ]),
      };
    }

    /**
     * A repayment. The split comes FROM the loan engine and is never inferred
     * here — principal/interest allocation is an amortisation decision, and if
     * accounting re-derived it the ledger would disagree with the loan balance
     * the moment either side changed its rounding.
     *
     * ## The debit is what was RECEIVED, not what was allocated
     *
     * `repayments.amount_paid` is not bounded by what is owed — the store
     * request validates only `numeric, min:0.01` — and the excess is persisted
     * as `repayments.overpayment`. Debiting only `principal + interest +
     * penalty + fees`, as this rule used to, understates the drawer by exactly
     * that excess, so the ledger's cash balance stops matching the cash there
     * actually is.
     *
     * The excess is credited to `borrower_advances`, a LIABILITY: it is money
     * the organisation is holding, not money it has earned, and crediting it to
     * any income account would report revenue the borrower can still ask back.
     *
     *     allocated + overpayment = received       (asserted, not assumed)
     */
    case "loan_collection": {
      const {
        principal,
        interest,
        penalty,
        fees = 0,
        overpayment = 0,
      } = input.allocation;
      // Each part on its own terms, THEN the total. Checking only the total
      // let fractional and negative components through — see `requireComponent`.
      requireComponent(principal, "The principal component");
      requireComponent(interest, "The interest component");
      requireComponent(penalty, "The penalty component");
      requireComponent(fees, "The fees component");
      requireComponent(overpayment, "The overpayment");
      const received = requireAmount(input.received, "A collection");
      const allocated = sumCentavos([principal, interest, penalty, fees]);

      if (allocated + overpayment !== received) {
        throw new Error(
          `This payment does not reconcile: ${formatCentavos(allocated)} allocated plus ` +
            `${formatCentavos(overpayment)} unallocated is ${formatCentavos(allocated + overpayment)}, ` +
            `but ${formatCentavos(received)} was received.`
        );
      }

      return {
        ...base,
        source: "loan_collection",
        description: "Loan collection",
        lines: used([
          debit(settlementAccountId(input.method, mapping), received),
          credit(mapping.loans_receivable, principal),
          credit(mapping.interest_income, interest),
          credit(mapping.penalty_income, penalty),
          credit(mapping.processing_fee_income, fees),
          // Held, not earned.
          credit(mapping.borrower_advances, overpayment),
        ]),
      };
    }

    /**
     * Company money moving between its own accounts. Emphatically NOT income —
     * treating a GCash-to-bank sweep as revenue would inflate the income
     * statement by the entire amount swept, which is the single most damaging
     * mistake a naive implementation makes.
     */
    case "fund_transfer": {
      const amount = requireAmount(input.amount, "A transfer");
      if (input.from === input.to) {
        throw new Error("A transfer cannot move money into the same account.");
      }
      return {
        ...base,
        source: "transfer",
        description: `Fund transfer from ${input.from} to ${input.to}`,
        lines: [
          debit(settlementAccountId(input.to, mapping), amount),
          credit(settlementAccountId(input.from, mapping), amount),
        ],
      };
    }

    /** A wallet's own fee — an expense, paid out of that wallet. */
    case "wallet_charge": {
      const amount = requireAmount(input.amount, "A charge");
      return {
        ...base,
        source: "gcash",
        description: "Wallet service charge",
        lines: [
          debit(input.expense_account_id, amount),
          credit(settlementAccountId(input.method, mapping), amount),
        ],
      };
    }

    case "expense_cash": {
      const amount = requireAmount(input.amount, "An expense");
      return {
        ...base,
        source: "expense",
        description: "Expense paid",
        lines: [
          debit(input.expense_account_id, amount),
          credit(settlementAccountId(input.method, mapping), amount),
        ],
      };
    }

    /** Cost recognised now, cash paid later — the liability is booked today. */
    case "expense_accrual": {
      const amount = requireAmount(input.amount, "An expense");
      return {
        ...base,
        source: "payable",
        description: "Expense accrued",
        lines: [
          debit(input.expense_account_id, amount),
          credit(mapping.accounts_payable, amount),
        ],
      };
    }

    /** Settling that liability later. No expense — it was booked on accrual. */
    case "payable_payment": {
      const amount = requireAmount(input.amount, "A payment");
      return {
        ...base,
        source: "payable",
        description: "Payable settled",
        lines: [
          debit(mapping.accounts_payable, amount),
          credit(settlementAccountId(input.method, mapping), amount),
        ],
      };
    }

    /**
     * A processing fee paid separately from a repayment.
     *
     * Recognised immediately here. Under IFRS 9 a fee that is integral to
     * originating a financial asset forms part of its effective interest rate
     * and is amortised over the loan's life rather than taken up front — which
     * is why §19 exposes fee treatment as a configurable setting rather than
     * hard-coding it. This rule is the simple, and by far the more common,
     * treatment for the organisations this serves.
     */
    case "loan_fee": {
      const amount = requireAmount(input.amount, "A fee");
      return {
        ...base,
        source: "loan_fee",
        description: "Loan processing fee",
        lines: [
          debit(settlementAccountId(input.method, mapping), amount),
          credit(mapping.processing_fee_income, amount),
        ],
      };
    }

    /**
     * Recognising expected losses before any borrower has actually defaulted.
     * The allowance is a contra-asset, so crediting it REDUCES net loans
     * receivable without touching the gross figure the loan module reports.
     */
    case "credit_loss_provision": {
      const amount = requireAmount(input.amount, "A provision");
      return {
        ...base,
        source: "credit_loss",
        description: "Credit loss provision",
        lines: [
          debit(mapping.credit_loss_expense, amount),
          credit(mapping.allowance_credit_losses, amount),
        ],
      };
    }
  }
}
