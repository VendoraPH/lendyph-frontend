"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { StepOneData } from "./step-personal";
import type { StepTwoData } from "./step-contact";

type FullFormData = StepOneData & StepTwoData;

interface ReviewRow {
  label: string;
  value: string;
}

interface Props {
  data: FullFormData;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

function Row({ label, value }: ReviewRow) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-2.5 border-b border-border last:border-0 gap-0.5 sm:gap-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40 shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground italic">—</span>}
      </span>
    </div>
  );
}

export function StepReview({ data, submitting, onSubmit, onBack }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3">
          Personal Information
        </p>
        <div className="rounded-lg border bg-muted/30 px-4 divide-y divide-border">
          <Row label="First Name" value={data.first_name} />
          <Row label="Middle Name" value={data.middle_name} />
          <Row label="Last Name" value={data.last_name} />
          <Row label="Suffix" value={data.suffix && data.suffix !== "none" ? data.suffix : "—"} />
          <Row label="Date of Birth" value={data.birthdate} />
          <Row label="Gender" value={data.gender ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1) : ""} />
          <Row label="Civil Status" value={data.civil_status ? data.civil_status.charAt(0).toUpperCase() + data.civil_status.slice(1) : ""} />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3">
          Contact &amp; Address
        </p>
        <div className="rounded-lg border bg-muted/30 px-4 divide-y divide-border">
          <Row label="Contact Number" value={data.contact_number} />
          <Row label="Email" value={data.email} />
          <Row label="Street Address" value={data.address} />
          <Row label="Barangay" value={data.barangay} />
          <Row label="City / Municipality" value={data.city} />
          <Row label="Province" value={data.province} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Please review your details carefully before submitting.
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Registration"
          )}
        </Button>
      </div>
    </div>
  );
}
