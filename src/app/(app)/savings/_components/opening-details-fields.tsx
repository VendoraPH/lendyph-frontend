"use client";

import { Input } from "@/components/ui/input";
import { StaffPicker } from "@/components/common/staff-picker";
import { SOURCE_OF_FUNDS_OPTIONS, type OpeningDetailsDraft } from "../_lib/opening-draft";
import { FormField } from "./field";
import { OptionSelect } from "./option-select";

interface OpeningDetailsFieldsProps {
  value: OpeningDetailsDraft;
  onChange: <K extends keyof OpeningDetailsDraft>(key: K, value: OpeningDetailsDraft[K]) => void;
  /** Shows "say where the money comes from" once a save was tried. */
  sourceError: string | null;
}

const NO_SOURCE = "none";
const SOURCE_OPTIONS = [{ value: NO_SOURCE, label: "Not given" }, ...SOURCE_OF_FUNDS_OPTIONS];

/** The optional opening details (gap round S1): account officer, source of funds and beneficiary. */
export function OpeningDetailsFields({ value, onChange, sourceError }: OpeningDetailsFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="sv-officer" label="Account officer (optional)">
          <StaffPicker
            id="sv-officer"
            value={value.officer}
            onChange={(officer) => onChange("officer", officer)}
            purpose="savings"
            clearable
          />
        </FormField>
        <FormField id="sv-source" label="Source of funds (optional)">
          <OptionSelect
            id="sv-source"
            value={value.source || NO_SOURCE}
            onChange={(v) => onChange("source", v === NO_SOURCE ? "" : (v as OpeningDetailsDraft["source"]))}
            options={SOURCE_OPTIONS}
          />
        </FormField>
      </div>
      {value.source === "other" && (
        <FormField id="sv-source-other" label="Where the money comes from" error={sourceError}>
          <Input
            id="sv-source-other"
            maxLength={120}
            value={value.sourceOther}
            onChange={(e) => onChange("sourceOther", e.target.value)}
            placeholder="Rental income"
          />
        </FormField>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Beneficiary (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="sv-ben-name" label="Name">
            <Input
              id="sv-ben-name"
              maxLength={150}
              value={value.beneficiaryName}
              onChange={(e) => onChange("beneficiaryName", e.target.value)}
            />
          </FormField>
          <FormField id="sv-ben-rel" label="Relationship">
            <Input
              id="sv-ben-rel"
              maxLength={60}
              value={value.beneficiaryRelationship}
              onChange={(e) => onChange("beneficiaryRelationship", e.target.value)}
              placeholder="Spouse"
            />
          </FormField>
          <FormField id="sv-ben-contact" label="Contact number">
            <Input
              id="sv-ben-contact"
              type="tel"
              inputMode="tel"
              maxLength={20}
              value={value.beneficiaryContact}
              onChange={(e) => onChange("beneficiaryContact", e.target.value)}
              placeholder="09171234567"
            />
          </FormField>
        </div>
      </fieldset>
    </div>
  );
}
