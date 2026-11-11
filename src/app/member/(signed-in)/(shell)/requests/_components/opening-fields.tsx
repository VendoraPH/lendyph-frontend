import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField, fieldAria } from "@/components/portal/form-field";
import { Money } from "@/components/portal/money";
import type { FormErrors, OpeningForm } from "@/lib/portal/request-forms";
import type { RequestOptions } from "@/lib/portal/types";

/** A new savings account: the product and the opening deposit the member brings to the branch. */
export function OpeningFields({
  form,
  onChange,
  options,
  errors,
}: {
  form: OpeningForm;
  onChange: (form: OpeningForm) => void;
  options: RequestOptions;
  errors: FormErrors;
}) {
  const set = (patch: Partial<OpeningForm>) => onChange({ ...form, ...patch });
  const product = options.opening_products.find((p) => String(p.id) === form.product_id);

  if (options.opening_products.length === 0) {
    return <p className="text-sm text-muted-foreground">There are no savings products you can open from here right now.</p>;
  }

  return (
    <div className="space-y-4">
      <FormField
        id="op-product"
        label="Savings product"
        error={errors.product_id}
        hint={product ? <>Minimum opening deposit: <Money value={product.minimum_opening_balance} /></> : undefined}
      >
        <NativeSelect
          id="op-product"
          className="w-full"
          value={form.product_id}
          onChange={(e) => set({ product_id: e.target.value })}
          {...fieldAria("op-product", errors.product_id, !!product)}
        >
          <NativeSelectOption value="">Choose a product</NativeSelectOption>
          {options.opening_products.map((p) => (
            <NativeSelectOption key={p.id} value={String(p.id)}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="op-deposit" label="Opening deposit (₱)" error={errors.initial_deposit}>
        <Input
          id="op-deposit"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={form.initial_deposit}
          onChange={(e) => set({ initial_deposit: e.target.value })}
          {...fieldAria("op-deposit", errors.initial_deposit)}
        />
      </FormField>
      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <Checkbox id="op-terms" checked={form.terms_accepted} onCheckedChange={(v) => set({ terms_accepted: v === true })} />
          <Label htmlFor="op-terms" className="leading-snug font-normal">
            I&apos;ll bring the opening deposit to my branch, and I accept the product&apos;s terms.
          </Label>
        </div>
        {errors.terms_accepted && <p className="text-xs text-destructive">{errors.terms_accepted}</p>}
      </div>
    </div>
  );
}
