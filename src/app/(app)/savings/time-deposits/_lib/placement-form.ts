import { parseMoneyInput } from "@/lib/money-input";
import type {
  MaturityInstruction,
  PlaceTimeDepositInput,
  SavingsMethod,
  SavingsProduct,
  TimeDepositQuoteInput,
} from "@/types";

/** The placement form as typed. */
export interface PlacementForm {
  memberId: number | null;
  productId: string;
  term: string;
  placementDate: string;
  amount: string;
  instruction: MaturityInstruction;
  method: SavingsMethod;
  /** The member's savings account paying for it, when the method is `savings`. */
  fundingAccountId: string;
  /** The member's savings account the maturity pays into, optional. */
  payoutAccountId: string;
  reference: string;
}

export interface PlacementCheck {
  errors: Record<"member" | "product" | "term" | "amount" | "date" | "funding", string | null>;
  quote: TimeDepositQuoteInput | null;
  body: PlaceTimeDepositInput | null;
}

/**
 * Checks the form and builds the quote request and the placement body. The
 * amount is sent exactly as typed; the server checks the minimum and works
 * out every figure.
 */
export function checkPlacement(form: PlacementForm, product: Pick<SavingsProduct, "id" | "term_options_days"> | null): PlacementCheck {
  const terms = product?.term_options_days ?? [];
  const term = terms.includes(Number(form.term)) ? Number(form.term) : null;
  const amount = parseMoneyInput(form.amount, { label: "Amount placed" });
  const funding = form.method === "savings" ? Number(form.fundingAccountId) || null : null;
  const errors = {
    member: form.memberId ? null : "Choose the member.",
    product: product ? null : "Choose a time deposit product.",
    term: term ? null : "Choose the term.",
    amount: amount.ok ? null : amount.message,
    date: /^\d{4}-\d{2}-\d{2}$/.test(form.placementDate) ? null : "Enter the placement date.",
    funding: form.method === "savings" && !funding ? "Choose the savings account that pays for it." : null,
  };
  const quote =
    product && term && amount.ok && !errors.date
      ? {
          ...(form.memberId ? { borrower_id: form.memberId } : {}),
          product_id: product.id,
          principal: amount.value,
          term_days: term,
          placement_date: form.placementDate,
        }
      : null;
  const valid = Object.values(errors).every((e) => e === null);
  const body: PlaceTimeDepositInput | null =
    valid && quote && form.memberId
      ? {
          borrower_id: form.memberId,
          product_id: quote.product_id,
          principal: quote.principal,
          term_days: quote.term_days,
          placement_date: quote.placement_date,
          maturity_instruction: form.instruction,
          payment_method: form.method,
          ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
          ...(funding ? { funding_account_id: funding } : {}),
          ...(Number(form.payoutAccountId) ? { payout_account_id: Number(form.payoutAccountId) } : {}),
        }
      : null;
  return { errors, quote, body };
}
