"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentRequirement, OriginationSettings } from "@/types/loan-origination";
import { useLoanProducts } from "../../../reminders/_hooks/use-loan-products";
import { SettingsCard, ToggleField } from "./fields";

type ProductRule = OriginationSettings["products"][number];

const blank = (loan_product_id: number): ProductRule => ({
  loan_product_id,
  online: false,
  required_fields: [],
  eligibility: null,
  required_documents: [],
  instructions: null,
});

/**
 * Per product: whether it is offered online, who may apply, and which
 * documents it asks for. A product with no saved rule starts switched off.
 */
export function ProductsSection({
  value,
  documentTypes,
  onChange,
}: {
  value: ProductRule[];
  documentTypes: DocumentRequirement[];
  onChange: (next: ProductRule[]) => void;
}) {
  const { products, error } = useLoanProducts();
  const ruleFor = (id: number) => value.find((r) => r.loan_product_id === id) ?? blank(id);
  const set = (id: number, patch: Partial<ProductRule>) => {
    const next = { ...ruleFor(id), ...patch };
    onChange(value.some((r) => r.loan_product_id === id) ? value.map((r) => (r.loan_product_id === id ? next : r)) : [...value, next]);
  };

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  return (
    <div className="space-y-4">
      {products.map((p) => {
        const rule = ruleFor(p.id);
        return (
          <SettingsCard key={p.id} title={p.name} description="Its amounts, terms and rates come from the loan product itself.">
            <ToggleField
              label="Offer online"
              checked={rule.online}
              onChange={(online) => set(p.id, { online })}
            />
            {rule.online && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`elig-${p.id}`}>Who may apply</Label>
                    <Textarea
                      id={`elig-${p.id}`}
                      rows={3}
                      value={rule.eligibility ?? ""}
                      onChange={(e) => set(p.id, { eligibility: e.target.value || null })}
                      placeholder="Members for at least 6 months, aged 21 to 65"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`instr-${p.id}`}>Instructions for applicants</Label>
                    <Textarea
                      id={`instr-${p.id}`}
                      rows={3}
                      value={rule.instructions ?? ""}
                      onChange={(e) => set(p.id, { instructions: e.target.value || null })}
                    />
                  </div>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Documents asked for</legend>
                  {documentTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Add document types under Documents first.</p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {documentTypes.map((d) => (
                        <label key={d.type} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={d.required || rule.required_documents.includes(d.type)}
                            disabled={d.required}
                            onCheckedChange={(on) =>
                              set(p.id, {
                                required_documents: on
                                  ? [...rule.required_documents, d.type]
                                  : rule.required_documents.filter((x) => x !== d.type),
                              })
                            }
                          />
                          {d.label}
                          {d.required && <span className="text-xs text-muted-foreground">(always)</span>}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </>
            )}
          </SettingsCard>
        );
      })}
    </div>
  );
}
