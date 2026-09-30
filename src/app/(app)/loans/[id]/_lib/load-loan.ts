import { httpStatusOf } from "@/lib/api-error";
import { loanService } from "@/services/loan.service";
import { loanProductService } from "@/services/loan-product.service";
import type { Loan } from "@/types/loan";

// ── Loan product resolution ──
// Action endpoints (submit/approve/reject/release/void/extend/etc.) commonly
// return a leaner loan payload than GET /api/loans/{id} and don't eager-load
// the `loan_product` relation. Left unhandled, the next setLoan(...) call
// wipes out a product name the page already had, and "Loan Product" (incl.
// the Release modal) shows "N/A" even though nothing about the product
// actually changed.

async function enrichLoanProduct(data: Loan): Promise<Loan> {
  const productId = data.loan_product?.id ?? data.loan_product_id;
  if (productId && !data.loan_product?.name && !data.loan_product_name) {
    try {
      const product = await loanProductService.detail(productId);
      if (product?.name) {
        return {
          ...data,
          loan_product: { ...(data.loan_product ?? {}), id: productId, name: product.name },
        };
      }
    } catch { /* product fetch is non-critical */ }
  }
  return data;
}

// Resolves the freshest loan_product info for `updated`, falling back to a
// product-id lookup and finally to whatever `prev` already had on hand.
async function resolveLoan(prev: Loan | null, updated: Loan): Promise<Loan> {
  if (updated.loan_product?.name || updated.loan_product_name) return updated;
  const enriched = await enrichLoanProduct(updated);
  if (enriched.loan_product?.name || enriched.loan_product_name) return enriched;
  if (prev?.loan_product?.name || prev?.loan_product_name) {
    return {
      ...updated,
      loan_product: prev.loan_product,
      loan_product_name: prev.loan_product_name,
    };
  }
  return updated;
}

/**
 * GET the loan and fill in what the detail payload can leave out: its product
 * name. This is the ONLY way the loan page reads a loan, on first load and
 * after every action, so the product it shows cannot differ between a fresh
 * page and one an action just refreshed.
 *
 * The co-makers are exactly the `co_makers` the server sent, with nothing
 * filled in. An empty list used to be filled with the borrower's registered
 * co-makers, which showed co-makers the loan was never given, on the page and
 * in the Release dialog.
 *
 * `prev` is the loan already on screen, the product-name fallback of last
 * resort. Pass null on first load.
 */
export async function loadLoan(id: number, prev: Loan | null): Promise<Loan> {
  return resolveLoan(prev, await loanService.detail(id));
}

/**
 * What a rejected `loadLoan` means for the page.
 *
 * Only a 404 says the loan does not exist. A rate limit, a server error or a
 * dropped connection says nothing about the loan, so it is a failed load the
 * user can retry: calling it "not found" told staff on staging that a loan
 * which was there all along did not exist, when the API had only answered 429.
 * A 401, 403 or 423 is a failed load here too; the app's own handling of those
 * (the expired-session dialog, the password-change redirect) runs regardless.
 */
export function loanLoadFailure(err: unknown): "not_found" | "failed" {
  return httpStatusOf(err) === 404 ? "not_found" : "failed";
}
