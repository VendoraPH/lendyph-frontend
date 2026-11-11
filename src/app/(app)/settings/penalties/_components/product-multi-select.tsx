"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import type { LoanProduct } from "@/types/loan";

interface ProductMultiSelectProps {
  id?: string;
  products: LoanProduct[];
  value: number[];
  onChange: (ids: number[]) => void;
  /** Names a selected product already taken by another active configuration. */
  takenBy?: Map<number, string>;
  invalid?: boolean;
}

/** Searchable multi-select of loan products; each pick shows as a removable chip. */
export function ProductMultiSelect({ id, products, value, onChange, takenBy, invalid }: ProductMultiSelectProps) {
  const anchor = useComboboxAnchor();
  const selected = products.filter((p) => value.includes(p.id));

  return (
    <Combobox
      items={products}
      multiple
      value={selected}
      onValueChange={(next: LoanProduct[]) => onChange(next.map((p) => p.id))}
      itemToStringLabel={(p: LoanProduct) => p.name}
      isItemEqualToValue={(a: LoanProduct, b: LoanProduct) => a.id === b.id}
    >
      <ComboboxChips ref={anchor} aria-invalid={invalid || undefined}>
        <ComboboxValue>
          {(chosen: LoanProduct[]) =>
            chosen.map((p) => (
              <ComboboxChip key={p.id} className={takenBy?.has(p.id) ? "bg-destructive/10 text-destructive" : undefined}>
                {p.name}
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput id={id} placeholder={selected.length ? "" : "Search loan products…"} />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No loan products match.</ComboboxEmpty>
        <ComboboxList>
          {(p: LoanProduct) => (
            <ComboboxItem key={p.id} value={p}>
              <span className="truncate">{p.name}</span>
              {takenBy?.has(p.id) && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">in {takenBy.get(p.id)}</span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
