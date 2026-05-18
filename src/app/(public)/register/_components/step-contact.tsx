"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface StepTwoData {
  contact_number: string;
  email: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
}

interface Props {
  data: StepTwoData;
  errors: Partial<Record<keyof StepTwoData, string>>;
  onChange: <K extends keyof StepTwoData>(field: K, value: StepTwoData[K]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepContact({ data, errors, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact_number">
            Contact Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact_number"
            type="tel"
            placeholder="09XXXXXXXXX"
            value={data.contact_number}
            onChange={(e) => onChange("contact_number", e.target.value)}
            className={errors.contact_number ? "border-destructive" : ""}
          />
          {errors.contact_number && (
            <p className="text-xs text-destructive">{errors.contact_number}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">
          Street Address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="address"
          placeholder="House/Lot/Block number, Street name"
          value={data.address}
          onChange={(e) => onChange("address", e.target.value)}
          className={errors.address ? "border-destructive" : ""}
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="barangay">Barangay</Label>
          <Input
            id="barangay"
            placeholder="Barangay"
            value={data.barangay}
            onChange={(e) => onChange("barangay", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">
            City / Municipality <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            placeholder="City name"
            value={data.city}
            onChange={(e) => onChange("city", e.target.value)}
            className={errors.city ? "border-destructive" : ""}
          />
          {errors.city && (
            <p className="text-xs text-destructive">{errors.city}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="province">
          Province <span className="text-destructive">*</span>
        </Label>
        <Input
          id="province"
          placeholder="Province"
          value={data.province}
          onChange={(e) => onChange("province", e.target.value)}
          className={errors.province ? "border-destructive" : ""}
        />
        {errors.province && (
          <p className="text-xs text-destructive">{errors.province}</p>
        )}
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
