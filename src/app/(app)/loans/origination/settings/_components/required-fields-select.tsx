"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { FORM_SECTION_LABELS, requiredFieldOptions, type RequiredFieldOption } from "../../_lib/form-fields";

/**
 * A product's required fields: a searchable multi-select of the application
 * form's fields, in words, each pick a removable chip. It stores the keys the
 * server checks (`products[].required_fields`). Each chip's remove button is
 * named for its field ("Remove Employer name"): the shared chip's own has no
 * name, so it is drawn here with the same look.
 */
export function RequiredFieldsSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const anchor = useComboboxAnchor();
  const options = requiredFieldOptions(value);
  const selected = options.filter((o) => value.includes(o.key));

  return (
    <Combobox
      items={options}
      multiple
      value={selected}
      onValueChange={(next: RequiredFieldOption[]) => onChange(next.map((o) => o.key))}
      itemToStringLabel={(o: RequiredFieldOption) => o.label}
      isItemEqualToValue={(a: RequiredFieldOption, b: RequiredFieldOption) => a.key === b.key}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(chosen: RequiredFieldOption[]) =>
            chosen.map((o) => (
              <ComboboxChip key={o.key} showRemove={false}>
                {o.label}
                <ComboboxPrimitive.ChipRemove
                  render={<Button variant="ghost" size="icon-xs" />}
                  className="-ml-1 opacity-50 hover:opacity-100"
                  data-slot="combobox-chip-remove"
                  aria-label={`Remove ${o.label}`}
                >
                  <XIcon className="pointer-events-none" />
                </ComboboxPrimitive.ChipRemove>
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput id={id} placeholder={selected.length ? "" : "Search the form's fields…"} />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No field matches.</ComboboxEmpty>
        <ComboboxList>
          {(o: RequiredFieldOption) => (
            <ComboboxItem key={o.key} value={o}>
              <span className="truncate">{o.label}</span>
              {o.section && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{FORM_SECTION_LABELS[o.section]}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
