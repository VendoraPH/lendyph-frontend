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
 * will produce. The backend must mirror these rules exactly; the handoff doc
 * carries them as the contract.
 *
 * Two invariants hold for every rule here, and the tests assert both on every
 * shape: the result balances, and no zero-amount line is ever emitted.
 */

import { sumCentavos } from "./money";
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
      amount: number;
      method: SettlementMethod;
    })
  | (BaseInput & {
      event: "loan_collection";
      method: SettlementMethod;
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
     */
    case "loan_release": {
      const amount = requireAmount(input.amount, "A loan release");
      return {
        ...base,
        source: "loan_release",
        description: "Loan release",
        lines: [
          debit(mapping.loans_receivable, amount),
          credit(settlementAccountId(input.method, mapping), amount),
        ],
      };
    }

    /**
     * A repayment. The split comes FROM the loan engine and is never inferred
     * here — principal/interest allocation is an amortisation decision, and if
     * accounting re-derived it the ledger would disagree with the loan balance
     * the moment either side changed its rounding. The debit is the sum of the
     * parts, so the two can never drift.
     */
    case "loan_collection": {
      const { principal, interest, penalty, fees = 0 } = input.allocation;
      // Each part on its own terms, THEN the total. Checking only the total
      // let fractional and negative components through — see `requireComponent`.
      requireComponent(principal, "The principal component");
      requireComponent(interest, "The interest component");
      requireComponent(penalty, "The penalty component");
      requireComponent(fees, "The fees component");
      const total = sumCentavos([principal, interest, penalty, fees]);
      requireAmount(total, "A collection");

      return {
        ...base,
        source: "loan_collection",
        description: "Loan collection",
        lines: used([
          debit(settlementAccountId(input.method, mapping), total),
          credit(mapping.loans_receivable, principal),
          credit(mapping.interest_income, interest),
          credit(mapping.penalty_income, penalty),
          credit(mapping.processing_fee_income, fees),
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
