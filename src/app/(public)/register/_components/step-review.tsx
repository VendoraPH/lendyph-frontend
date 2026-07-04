"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS, VALID_ID_OPTIONS } from "@/constants";
import type { StepOneData } from "./step-personal";
import type { StepTwoData } from "./step-contact";
import type { StepSpouseData } from "./step-spouse";
import type { StepEmploymentData } from "./step-employment";
import type { ValidIdEntry } from "./step-photo-ids";

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
  photoPreview: string | null;
  validIds: ValidIdEntry[];
  branches: BranchOption[];
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
    return entry.custom_type_name ? `${entry.custom_type_name} (Others)` : "Others";
  }
  return VALID_ID_OPTIONS.find((o) => o.value === entry.type)?.label ?? entry.type;
}

export function StepReview({
  personal,
  contact,
  spouse,
  employment,
  photoPreview,
  validIds,
  branches,
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
      <div>
        <h3 className="text-sm font-semibold mb-1">Review Your Application</h3>
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
              <p className="text-xs text-muted-foreground italic">None provided</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {validIds.map((entry, i) => {
                  const previews = [
                    { label: "Front", src: entry.front_preview },
                    { label: "Back", src: entry.back_preview },
                  ].filter((p) => p.src);
                  return (
                    <li key={i} className="space-y-1.5">
                      <span className="font-medium">
                        {validIdTypeLabel(entry)}
                        {entry.id_number ? ` · ${entry.id_number}` : ""}
                      </span>
                      {previews.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No images</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {previews.map((p) => (
                            <div key={p.label} className="space-y-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.src as string}
                                alt={`${validIdTypeLabel(entry)} ${p.label}`}
                                className="h-24 w-36 rounded-md border object-cover bg-background"
                              />
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 text-center">
                                {p.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
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
          <Row label="Employer / Business" value={employment.employer_or_business} />
          <Row label="Date Hired" value={employment.date_hired} />
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
