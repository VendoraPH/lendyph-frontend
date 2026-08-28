// src/app/(app)/borrowers/registrations/[id]/_components/registration-info-cards.tsx
"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS } from "@/constants";
import type { Registration, RegistrationPayload } from "@/services/registration.service";
import { usePublicBranches } from "@/hooks/use-public-branches";
import { formatCurrency } from "@/lib/format";

interface Props {
  registration: Registration;
  editMode: boolean;
  draft: Partial<RegistrationPayload>;
  onDraftChange: <K extends keyof RegistrationPayload>(field: K, value: RegistrationPayload[K]) => void;
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </span>
      <span className="block text-sm font-semibold text-foreground truncate" title={value ?? undefined}>
        {value || <span className="text-muted-foreground italic font-normal">—</span>}
      </span>
    </div>
  );
}

export function RegistrationInfoCards({ registration: r, editMode, draft, onDraftChange }: Props) {
  const d = { ...r, ...draft };
  const { branches } = usePublicBranches();
  const branchName = useMemo(
    () =>
      r.branch_id != null
        ? branches.find((b) => b.id === r.branch_id)?.name ?? `Branch #${r.branch_id}`
        : undefined,
    [branches, r.branch_id]
  );
  const isMarried = r.civil_status === "married";
  const hasEmploymentInfo =
    branchName ||
    r.employer_or_business ||
    r.monthly_income != null ||
    r.pledge_amount != null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3 pb-2 border-b border-brand-orange/20">
            Personal Information
          </h3>
          {editMode ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="e_first_name">First Name</Label>
                  <Input id="e_first_name" value={d.first_name ?? ""} onChange={(e) => onDraftChange("first_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e_last_name">Last Name</Label>
                  <Input id="e_last_name" value={d.last_name ?? ""} onChange={(e) => onDraftChange("last_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e_middle_name">Middle Name</Label>
                  <Input id="e_middle_name" value={d.middle_name ?? ""} onChange={(e) => onDraftChange("middle_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Suffix</Label>
                  <Select value={d.suffix || undefined} onValueChange={(v) => onDraftChange("suffix", v ?? "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {SUFFIX_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value || "none"} value={opt.value || "none"}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e_birthdate">Date of Birth</Label>
                  <Input id="e_birthdate" type="date" value={d.birthdate ?? ""} onChange={(e) => onDraftChange("birthdate", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Civil Status</Label>
                  <Select value={d.civil_status || undefined} onValueChange={(v) => onDraftChange("civil_status", v ?? "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {CIVIL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <RadioGroup className="flex gap-5 pt-1" value={d.gender || undefined} onValueChange={(v) => onDraftChange("gender", v ?? "")}>
                    <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="male" /><span className="text-sm">Male</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="female" /><span className="text-sm">Female</span></label>
                  </RadioGroup>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-1">
              <ReadField label="First Name" value={r.first_name} />
              <ReadField label="Middle Name" value={r.middle_name} />
              <ReadField label="Last Name" value={r.last_name} />
              <ReadField label="Suffix" value={r.suffix} />
              <ReadField label="Date of Birth" value={r.birthdate} />
              <ReadField label="Gender" value={r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1) : undefined} />
              <ReadField label="Civil Status" value={r.civil_status ? r.civil_status.charAt(0).toUpperCase() + r.civil_status.slice(1) : undefined} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3 pb-2 border-b border-brand-orange/20">
            Contact &amp; Address
          </h3>
          {editMode ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="e_contact">Contact Number</Label>
                  <Input id="e_contact" type="tel" value={d.contact_number ?? ""} onChange={(e) => onDraftChange("contact_number", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e_email">Email</Label>
                  <Input id="e_email" type="email" value={d.email ?? ""} onChange={(e) => onDraftChange("email", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="e_address">Street Address</Label>
                <Input id="e_address" value={d.address ?? ""} onChange={(e) => onDraftChange("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="e_barangay">Barangay</Label>
                  <Input id="e_barangay" value={d.barangay ?? ""} onChange={(e) => onDraftChange("barangay", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e_city">City / Municipality</Label>
                  <Input id="e_city" value={d.city ?? ""} onChange={(e) => onDraftChange("city", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e_province">Province</Label>
                  <Input id="e_province" value={d.province ?? ""} onChange={(e) => onDraftChange("province", e.target.value)} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-1">
              <ReadField label="Contact Number" value={r.contact_number} />
              <ReadField label="Email" value={r.email} />
              <ReadField label="Street Address" value={r.address} />
              <ReadField label="Barangay" value={r.barangay} />
              <ReadField label="City / Municipality" value={r.city} />
              <ReadField label="Province" value={r.province} />
            </div>
          )}
        </CardContent>
      </Card>

      {isMarried && (
        <Card>
          <CardContent className="pt-5 space-y-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3 pb-2 border-b border-brand-orange/20">
              Spouse Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-1">
              <ReadField label="First Name" value={r.spouse_first_name} />
              <ReadField label="Middle Name" value={r.spouse_middle_name} />
              <ReadField label="Last Name" value={r.spouse_last_name} />
              <ReadField label="Contact Number" value={r.spouse_contact_number} />
              <ReadField label="Occupation" value={r.spouse_occupation} />
            </div>
          </CardContent>
        </Card>
      )}

      {hasEmploymentInfo && (
        <Card>
          <CardContent className="pt-5 space-y-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3 pb-2 border-b border-brand-orange/20">
              Employment &amp; Membership
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-1">
              <ReadField label="Preferred Branch" value={branchName} />
              <ReadField label="Employer / Business" value={r.employer_or_business} />
              <ReadField
                label="Monthly Income"
                value={
                  r.monthly_income != null
                    ? formatCurrency(r.monthly_income)
                    : undefined
                }
              />
              <ReadField
                label="Pledge Amount"
                value={
                  r.pledge_amount != null
                    ? formatCurrency(r.pledge_amount)
                    : undefined
                }
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
