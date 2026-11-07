"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { parseAmount } from "@/lib/portal/requests";
import { DetailItem } from "../../../../_components/detail-item";
import type { StepProps } from "./detail-steps";

const money = (text: string) => (text.trim() ? formatCurrency(parseAmount(text)) : null);

/** Everything the member entered, and the declaration they sign by submitting. */
export function ReviewStep({ draft, set, product }: StepProps) {
  const files = Object.entries(draft.documents).filter(([, f]) => f);
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-6">
        <DetailItem label="Product" value={product.name} />
        <DetailItem label="Amount" value={money(draft.amount)} />
        <DetailItem label="Term" value={`${draft.term} ${product.term_unit}`} />
        <DetailItem label="Purpose" value={draft.purpose} />
        {product.requires_income_info && (
          <>
            <DetailItem label="Monthly income" value={money(draft.monthly_income)} />
            <DetailItem label="Other monthly income" value={money(draft.other_income)} />
            <DetailItem label="Monthly expenses" value={money(draft.monthly_expenses)} />
            <DetailItem label="Source of income" value={draft.income_source} />
          </>
        )}
        {product.requires_collateral && (
          <>
            <DetailItem label="Collateral" value={draft.collateral_description} />
            <DetailItem label="Estimated value" value={money(draft.collateral_value)} />
          </>
        )}
        {files.length > 0 && (
          <DetailItem label="Documents" value={files.map(([name]) => name).join(", ")} />
        )}
      </dl>
      <label htmlFor="app-declaration" className="flex items-start gap-2 rounded-lg border p-3 text-sm">
        <Checkbox
          id="app-declaration"
          checked={draft.declaration}
          onCheckedChange={(on) => set({ declaration: on === true })}
        />
        <span>
          I declare that the information above is true and complete. I understand that the cooperative will review
          this application and may ask for more documents, and that submitting it does not mean the loan is approved.
        </span>
      </label>
    </div>
  );
}
