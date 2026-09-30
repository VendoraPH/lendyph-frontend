"use client";

import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RELATIONSHIP_OPTIONS } from "@/constants";
import type {
  CoMakerDetailsErrors,
  CoMakerDetailsField,
  CoMakerFormData,
} from "@/lib/co-maker-edit";

/**
 * The API's `max:` for each text column (Store/UpdateCoMakerRequest), so an
 * over-long value is stopped while typing rather than refused by a 422.
 */
const MAX_LENGTH = {
  first_name: 255,
  middle_name: 255,
  last_name: 255,
  suffix: 20,
  phone: 20,
  occupation: 255,
  employer: 255,
  address: 1000,
} as const;

function relationshipLabel(value: string | null): string {
  if (!value) return "Select relationship";
  // A value from outside the list (typed on the loan screen) reads as itself.
  return RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

interface CoMakerFormFieldsProps {
  form: CoMakerFormData;
  update: (field: keyof CoMakerFormData, value: string) => void;
  errors?: CoMakerDetailsErrors;
  disabled?: boolean;
}

/** The co-maker's own details, shared by the add and edit dialogs. */
export function CoMakerFormFields({
  form,
  update,
  errors = {},
  disabled,
}: CoMakerFormFieldsProps) {
  const invalid = (field: CoMakerDetailsField) => (errors[field] ? true : undefined);
  const describedBy = (field: CoMakerDetailsField) =>
    errors[field] ? `cm_${field}_error` : undefined;

  return (
    <div className="space-y-4">
      {/* Personal Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="cm_first_name">First Name *</Label>
          <Input
            id="cm_first_name"
            placeholder="Juan"
            value={form.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            maxLength={MAX_LENGTH.first_name}
            disabled={disabled}
            aria-invalid={invalid("first_name")}
            aria-describedby={describedBy("first_name")}
            required
          />
          <FieldError id="cm_first_name_error" className="text-xs">
            {errors.first_name}
          </FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_middle_name">Middle Name</Label>
          <Input
            id="cm_middle_name"
            placeholder="Santos"
            value={form.middle_name}
            onChange={(e) => update("middle_name", e.target.value)}
            maxLength={MAX_LENGTH.middle_name}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_last_name">Last Name *</Label>
          <Input
            id="cm_last_name"
            placeholder="Dela Cruz"
            value={form.last_name}
            onChange={(e) => update("last_name", e.target.value)}
            maxLength={MAX_LENGTH.last_name}
            disabled={disabled}
            aria-invalid={invalid("last_name")}
            aria-describedby={describedBy("last_name")}
            required
          />
          <FieldError id="cm_last_name_error" className="text-xs">
            {errors.last_name}
          </FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_suffix">Suffix</Label>
          <Input
            id="cm_suffix"
            placeholder="Jr., Sr., III"
            value={form.suffix}
            onChange={(e) => update("suffix", e.target.value)}
            maxLength={MAX_LENGTH.suffix}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_relationship">Relationship to Member *</Label>
          <Select
            value={form.relationship || null}
            onValueChange={(v) => update("relationship", v ?? "")}
            disabled={disabled}
          >
            <SelectTrigger
              id="cm_relationship"
              className="w-full"
              aria-invalid={invalid("relationship")}
              aria-describedby={describedBy("relationship")}
            >
              {/* The label, not the stored value: "Sibling", not "sibling". */}
              <SelectValue placeholder="Select relationship">{relationshipLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="cm_relationship_error" className="text-xs">
            {errors.relationship}
          </FieldError>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_phone">Contact Number *</Label>
          <Input
            id="cm_phone"
            type="tel"
            placeholder="09XXXXXXXXX"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            maxLength={MAX_LENGTH.phone}
            disabled={disabled}
            aria-invalid={invalid("phone")}
            aria-describedby={describedBy("phone")}
            required
          />
          <FieldError id="cm_phone_error" className="text-xs">
            {errors.phone}
          </FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_occupation">Occupation</Label>
          <Input
            id="cm_occupation"
            placeholder="e.g. Teacher, Engineer"
            value={form.occupation}
            onChange={(e) => update("occupation", e.target.value)}
            maxLength={MAX_LENGTH.occupation}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cm_address">Address</Label>
        <Textarea
          id="cm_address"
          placeholder="Full address"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          maxLength={MAX_LENGTH.address}
          disabled={disabled}
        />
      </div>

      {/* Employment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_employer">Employer / Business</Label>
          <Input
            id="cm_employer"
            placeholder="Company or business name"
            value={form.employer}
            onChange={(e) => update("employer", e.target.value)}
            maxLength={MAX_LENGTH.employer}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_income">Monthly Income (PHP)</Label>
          <Input
            id="cm_income"
            type="number"
            min={0}
            // "any", not a step of 100: the browser refuses to submit a value
            // off the step, so a stored income like 20050.00 blocked Save.
            step="any"
            placeholder="0"
            value={form.monthly_income}
            onChange={(e) => update("monthly_income", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
