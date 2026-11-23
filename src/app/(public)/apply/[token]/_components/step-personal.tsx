"use client";

import { CIVIL_STATUS_OPTIONS, GENDER_OPTIONS } from "@/constants";
import { TextField, SelectField } from "./form-field";
import type { StepProps } from "./step-types";

const OWNERSHIP = [
  { value: "owned", label: "Owned" },
  { value: "rented", label: "Rented" },
  { value: "living_with_family", label: "Living with family" },
  { value: "other", label: "Other" },
];

export function StepPersonal({
  value: p,
  errors,
  onChange,
  branches,
}: StepProps<"personal"> & { branches: { id: number; name: string }[] }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <TextField id="first_name" label="First name" required autoComplete="given-name" value={p.first_name} error={errors.first_name} onChange={(first_name) => onChange({ first_name })} />
        <TextField id="middle_name" label="Middle name" autoComplete="additional-name" value={p.middle_name} error={errors.middle_name} onChange={(middle_name) => onChange({ middle_name })} />
        <TextField id="last_name" label="Last name" required autoComplete="family-name" value={p.last_name} error={errors.last_name} onChange={(last_name) => onChange({ last_name })} />
        <TextField id="suffix" label="Suffix" placeholder="Jr., III" value={p.suffix} error={errors.suffix} onChange={(suffix) => onChange({ suffix })} />
        <TextField id="date_of_birth" label="Date of birth" required type="date" autoComplete="bday" value={p.date_of_birth} error={errors.date_of_birth} onChange={(date_of_birth) => onChange({ date_of_birth })} />
        {/* Required, as a member record requires them (round fz): the hand-off makes the member from these. */}
        <SelectField id="gender" label="Gender" required options={GENDER_OPTIONS} value={p.gender} error={errors.gender} onChange={(gender) => onChange({ gender })} />
        <SelectField id="civil_status" label="Civil status" required options={CIVIL_STATUS_OPTIONS} value={p.civil_status} error={errors.civil_status} onChange={(civil_status) => onChange({ civil_status })} />
        <TextField id="nationality" label="Nationality" value={p.nationality} error={errors.nationality} onChange={(nationality) => onChange({ nationality })} />
        <TextField id="dependents" label="Number of dependents" inputMode="numeric" value={p.dependents} error={errors.dependents} onChange={(dependents) => onChange({ dependents })} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Home address</h3>
        <TextField id="street_address" label="House number and street" required className="sm:col-span-2" autoComplete="street-address" value={p.street_address} error={errors.street_address} onChange={(street_address) => onChange({ street_address })} />
        <TextField id="barangay" label="Barangay" required value={p.barangay} error={errors.barangay} onChange={(barangay) => onChange({ barangay })} />
        <TextField id="city" label="City or municipality" required autoComplete="address-level2" value={p.city} error={errors.city} onChange={(city) => onChange({ city })} />
        <TextField id="region" label="Region" value={p.region} error={errors.region} onChange={(region) => onChange({ region })} />
        <TextField id="province" label="Province" required autoComplete="address-level1" value={p.province} error={errors.province} onChange={(province) => onChange({ province })} />
        <TextField id="postal_code" label="Postal code" inputMode="numeric" autoComplete="postal-code" maxLength={4} value={p.postal_code} error={errors.postal_code} onChange={(postal_code) => onChange({ postal_code })} />
        <TextField id="years_at_residence" label="Years at this address" inputMode="decimal" value={p.years_at_residence} error={errors.years_at_residence} onChange={(years_at_residence) => onChange({ years_at_residence })} />
        <SelectField id="residence_ownership" label="This home is" options={OWNERSHIP} value={p.residence_ownership} error={errors.residence_ownership} onChange={(residence_ownership) => onChange({ residence_ownership })} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Membership</h3>
        <TextField id="membership_number" label="Membership number" hint="If you are already a member." value={p.membership_number} error={errors.membership_number} onChange={(membership_number) => onChange({ membership_number })} />
        {/* Shown while there's a choice to make, or none made yet: a submit needs a branch. */}
        {(branches.length > 1 || (branches.length === 1 && p.branch_id === null)) && (
          <SelectField
            id="branch_id"
            label="Nearest branch"
            options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            value={p.branch_id === null ? "" : String(p.branch_id)}
            error={errors.branch_id}
            onChange={(v) => onChange({ branch_id: v ? Number(v) : null })}
          />
        )}
      </section>
    </div>
  );
}
