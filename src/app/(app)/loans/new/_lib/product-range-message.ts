import { formatCurrency } from "@/lib/format";

// `LoanService::assertPrincipalWithinProductRange()` answers 422 with the
// product's bound as a raw decimal ("… for this product is 50000.00.").
const PRODUCT_RANGE = /^((?:Minimum|Maximum) loan amount for this product is )(\d+(?:\.\d+)?)(\.?)$/;

/**
 * A save error as the loan form shows it: the server's product amount-range
 * message gets its amount in pesos (₱50,000.00). Any other message is
 * unchanged.
 */
export function formatProductRangeMessage(message: string): string {
  const match = PRODUCT_RANGE.exec(message);
  if (!match) return message;
  const [, lead, amount, stop] = match;
  return `${lead}${formatCurrency(amount)}${stop}`;
}
