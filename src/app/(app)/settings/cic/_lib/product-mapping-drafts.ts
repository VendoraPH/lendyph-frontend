// The product mapping table's rows as the user edits them, and how a server
// listing is folded back in. Pure, so it is unit-tested.
import type { CicContractRecordType, CicProductMappings } from "@/types/cic";

export interface ProductMappingDraft {
  loan_product_id: number;
  name: string;
  record_type: CicContractRecordType | null;
  contract_type: string | null;
  transaction_type: string | null;
  purpose_code: string | null;
}

export function draftsOf(m: CicProductMappings): ProductMappingDraft[] {
  return m.products.map((p) => ({
    loan_product_id: p.loan_product.id,
    name: p.loan_product.name,
    record_type: p.mapping?.record_type ?? null,
    contract_type: p.mapping?.contract_type ?? null,
    transaction_type: p.mapping?.transaction_type ?? null,
    purpose_code: p.mapping?.purpose_code ?? null,
  }));
}

export function sameDraft(a: ProductMappingDraft, b: ProductMappingDraft | undefined): boolean {
  return (
    !!b &&
    a.record_type === b.record_type &&
    a.contract_type === b.contract_type &&
    a.transaction_type === b.transaction_type &&
    a.purpose_code === b.purpose_code
  );
}

/**
 * After one product's mapping is cleared: that row is taken from the server's
 * listing, and every other row keeps what the user typed and hasn't saved.
 * A product the listing no longer has is dropped; a new one is added.
 */
export function mergeClearedRow(
  rows: readonly ProductMappingDraft[],
  listing: CicProductMappings,
  clearedId: number,
): ProductMappingDraft[] {
  const fresh = draftsOf(listing);
  const local = new Map(rows.map((r) => [r.loan_product_id, r]));
  return fresh.map((f) => (f.loan_product_id === clearedId ? f : (local.get(f.loan_product_id) ?? f)));
}
