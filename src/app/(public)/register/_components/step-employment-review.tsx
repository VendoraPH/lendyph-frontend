"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS, VALID_ID_OPTIONS } from "@/constants";
import type { StepOneData } from "./step-personal";
import type { StepTwoData } from "./step-contact";
import type { StepSpouseData } from "./step-spouse";
import type { ValidIdEntry } from "./step-photo-ids";

export interface StepEmploymentData {
  employer_or_business: string;
  monthly_income: string;
  pledge_amount: string;
}

interface BranchOption {
  id: number | string;
  name: string;
  city?: string | null;
}

interface Props {
  personal: StepOneData;
  contact: StepTwoData;
  spouse: StepSpouseData;
  employment: StepEmploymentData;
  errors: Partial<Record<keyof StepEmploymentData, string>>;
  photoPreview: string | null;
  validIds: ValidIdEntry[];
  branches: BranchOption[];
  onEmploymentChange: <K extends keyof StepEmploymentData>(
    field: K,
    value: StepEmploymentData[K]
  ) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-border last:border-0 gap-0.5 sm:gap-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40 shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">
        {value ? value : <span className="text-muted-foreground italic">—</span>}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-2">
      {children}
    </p>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function suffixLabel(value: string) {
  if (!value || value === "none") return "";
  return SUFFIX_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function civilStatusLabel(value: string) {
  return CIVIL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? capitalize(value);
}

function validIdTypeLabel(entry: ValidIdEntry) {
  if (!entry.type) return "—";
  if (entry.type === "others") {
    return entry.custom_type_name
      ? `${entry.custom_type_name} (Others)`
      : "Others";
  }
  return VALID_ID_OPTIONS.find((o) => o.value === entry.type)?.label ?? entry.type;
}

export function StepEmploymentReview({
  personal,
  contact,
  spouse,
  employment,
  errors,
  photoPreview,
  validIds,
  branches,
  onEmploymentChange,
  onSubmit,
  onBack,
  submitting,
}: Props) {
  const branch = branches.find((b) => String(b.id) === personal.branch_id);
  const branchLabel = branch
    ? branch.city
      ? `${branch.name} — ${branch.city}`
      : branch.name
    : "";

  const isMarried = personal.civil_status === "married";

  return (
    <div className="space-y-6">
      {/* Employment & Income */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Employment &amp; Income</h3>

        <div className="space-y-1.5">
          <Label htmlFor="employer_or_business">Employer / Business Name</Label>
          <Input
            id="employer_or_business"
            placeholder="Company or business name"
            value={employment.employer_or_business}
            onChange={(e) => onEmploymentChange("employer_or_business", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="monthly_income">Monthly Income (PHP)</Label>
            <Input
              id="monthly_income"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={employment.monthly_income}
              onChange={(e) => onEmploymentChange("monthly_income", e.target.value)}
              className={errors.monthly_income ? "border-destructive" : ""}
            />
            {errors.monthly_income && (
              <p className="text-xs text-destructive">{errors.monthly_income}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pledge_amount">Pledge Amount (PHP)</Label>
            <Input
              id="pledge_amount"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={employment.pledge_amount}
              onChange={(e) => onEmploymentChange("pledge_amount", e.target.value)}
              className={errors.pledge_amount ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Share capital pledge. Defaults to ₱0 if left empty.
            </p>
            {errors.pledge_amount && (
              <p className="text-xs text-destructive">{errors.pledge_amount}</p>
            )}
          </div>
        </div>
      </div>

      {/* Review */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div>
          <h3 className="text-sm font-semibold mb-3">Review Your Application</h3>
          <p className="text-xs text-muted-foreground">
            Please review your details carefully before submitting.
          </p>
        </div>

        <div>
          <SectionTitle>Personal Information</SectionTitle>
          <div className="rounded-lg border bg-muted/30 px-4 divide-y divide-border">
            <Row label="First Name" value={personal.first_name} />
            <Row label="Middle Name" value={personal.middle_name} />
            <Row label="Last Name" value={personal.last_name} />
            <Row label="Suffix" value={suffixLabel(personal.suffix)} />
            <Row label="Date of Birth" value={personal.birthdate} />
            <Row label="Gender" value={capitalize(personal.gender)} />
            <Row label="Civil Status" value={civilStatusLabel(personal.civil_status)} />
            <Row label="Preferred Branch" value={branchLabel} />
          </div>
        </div>

        <div>
          <SectionTitle>Contact &amp; Address</SectionTitle>
          <div className="rounded-lg border bg-muted/30 px-4 divide-y divide-border">
            <Row label="Contact Number" value={contact.contact_number} />
            <Row label="Email" value={contact.email} />
            <Row label="Street Address" value={contact.address} />
            <Row label="Barangay" value={contact.barangay} />
            <Row label="City / Municipality" value={contact.city} />
            <Row label="Province" value={contact.province} />
          </div>
        </div>

        {isMarried && (
          <div>
            <SectionTitle>Spouse</SectionTitle>
            <div className="rounded-lg border bg-muted/30 px-4 divide-y divide-border">
              <Row label="First Name" value={spouse.spouse_first_name} />
              <Row label="Middle Name" value={spouse.spouse_middle_name} />
              <Row label="Last Name" value={spouse.spouse_last_name} />
              <Row label="Contact Number" value={spouse.spouse_contact_number} />
              <Row label="Occupation" value={spouse.spouse_occupation} />
            </div>
          </div>
        )}

        <div>
          <SectionTitle>Photo &amp; Valid IDs</SectionTitle>
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <div className="h-14 w-14 rounded-full overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-14 w-14 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground">
                  No photo
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Profile Photo</p>
                <p className="text-xs text-muted-foreground">
                  {photoPreview ? "Uploaded" : "Not provided"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Valid IDs ({validIds.length})
              </p>
              {validIds.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  None provided
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {validIds.map((entry, i) => {
                    const sides: string[] = [];
                    if (entry.front_preview) sides.push("Front");
                    if (entry.back_preview) sides.push("Back");
                    const sidesText = sides.length ? sides.join(" + ") : "No images";
                    return (
                      <li key={i} className="flex items-center justify-between">
                        <span className="font-medium">
                          {validIdTypeLabel(entry)}
                          {entry.id_number ? ` · ${entry.id_number}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {sidesText}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Employment &amp; Income</SectionTitle>
          <div className="rounded-lg border bg-muted/30 px-4 divide-y divide-border">
            <Row
              label="Employer / Business"
              value={employment.employer_or_business}
            />
            <Row
              label="Monthly Income"
              value={
                employment.monthly_income
                  ? `₱${Number(employment.monthly_income).toLocaleString()}`
                  : ""
              }
            />
            <Row
              label="Pledge Amount"
              value={`₱${(Number(employment.pledge_amount) || 0).toLocaleString()}`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
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
