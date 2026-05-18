"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface StepSpouseData {
  spouse_first_name: string;
  spouse_middle_name: string;
  spouse_last_name: string;
  spouse_contact_number: string;
  spouse_occupation: string;
}

interface Props {
  data: StepSpouseData;
  errors: Partial<Record<keyof StepSpouseData, string>>;
  onChange: <K extends keyof StepSpouseData>(field: K, value: StepSpouseData[K]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepSpouse({ data, errors, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="spouse_first_name">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="spouse_first_name"
            placeholder="First name"
            value={data.spouse_first_name}
            onChange={(e) => onChange("spouse_first_name", e.target.value)}
            className={errors.spouse_first_name ? "border-destructive" : ""}
          />
          {errors.spouse_first_name && (
            <p className="text-xs text-destructive">{errors.spouse_first_name}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouse_middle_name">Middle Name</Label>
          <Input
            id="spouse_middle_name"
            placeholder="Middle name"
            value={data.spouse_middle_name}
            onChange={(e) => onChange("spouse_middle_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouse_last_name">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="spouse_last_name"
            placeholder="Last name"
            value={data.spouse_last_name}
            onChange={(e) => onChange("spouse_last_name", e.target.value)}
            className={errors.spouse_last_name ? "border-destructive" : ""}
          />
          {errors.spouse_last_name && (
            <p className="text-xs text-destructive">{errors.spouse_last_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="spouse_contact_number">Contact Number</Label>
          <Input
            id="spouse_contact_number"
            type="tel"
            placeholder="09XXXXXXXXX"
            value={data.spouse_contact_number}
            onChange={(e) => onChange("spouse_contact_number", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouse_occupation">Occupation</Label>
          <Input
            id="spouse_occupation"
            placeholder="Occupation or employer"
            value={data.spouse_occupation}
            onChange={(e) => onChange("spouse_occupation", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
