import { loanService } from "@/services/loan.service";
import { coMakerService } from "@/services/co-maker.service";
import { loanProductService } from "@/services/loan-product.service";
import type { CoMaker } from "@/types";
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

// Resolve the loan's co-makers when the detail response doesn't embed
// them. Co-makers are loan-scoped (chosen at application time), so we
// hydrate from the loan's own id(s) / flat name first, and only fall
// back to the borrower's registered co-makers as a last resort.
async function hydrateCoMakers(data: Loan): Promise<Loan> {
  if (!data.co_makers || data.co_makers.length === 0) {
    const mapCoMaker = (cm: CoMaker) => ({
      id: cm.id,
      full_name: cm.full_name ?? cm.name ?? ([cm.first_name, cm.middle_name, cm.last_name, cm.suffix].filter(Boolean).join(" ") || undefined),
      address: cm.address,
      relationship: cm.relationship_to_borrower ?? cm.relationship,
    });
    const rawLoan = data as Loan & { co_maker_ids?: number[] };
    const coMakerIds = Array.isArray(rawLoan.co_maker_ids)
      ? rawLoan.co_maker_ids
      : data.co_maker_id != null
        ? [data.co_maker_id]
        : [];
    // 1) Explicit co-maker id(s) on the loan → fetch each by id.
    if (coMakerIds.length > 0) {
      try {
        const fetched = await Promise.all(
          coMakerIds.map((cid) => coMakerService.detail(cid).catch(() => null))
        );
        const mapped = fetched.filter((cm): cm is CoMaker => !!cm).map(mapCoMaker);
        if (mapped.length > 0) data.co_makers = mapped;
      } catch { /* non-critical */ }
    }
    // 2) Legacy flat name with no id.
    if ((!data.co_makers || data.co_makers.length === 0) && data.co_maker_name) {
      data.co_makers = [{ id: data.co_maker_id ?? 0, full_name: data.co_maker_name }];
    }
    // 3) Last resort: the borrower's registered co-makers.
    const borrowerId = data.borrower?.id ?? data.borrower_id;
    if ((!data.co_makers || data.co_makers.length === 0) && borrowerId) {
      try {
        const cms = await coMakerService.list(borrowerId);
        const cmList = Array.isArray(cms) ? cms : (cms as unknown as { data: CoMaker[] }).data ?? [];
        if (cmList.length > 0) data.co_makers = cmList.map(mapCoMaker);
      } catch { /* non-critical */ }
    }
  }
  return data;
}

/**
 * GET the loan and fill in what the detail payload can leave out: its
 * co-makers and its product name. This is the ONLY way the loan page reads a
 * loan, on first load and after every action, so the co-makers and product it
 * shows cannot differ between a fresh page and one an action just refreshed.
 *
 * `prev` is the loan already on screen, the product-name fallback of last
 * resort. Pass null on first load.
 */
export async function loadLoan(id: number, prev: Loan | null): Promise<Loan> {
  const data = await loanService.detail(id);
  return resolveLoan(prev, await hydrateCoMakers(data));
}
