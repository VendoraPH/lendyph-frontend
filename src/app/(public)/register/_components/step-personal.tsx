"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS } from "@/constants";
import { usePublicBranches } from "@/hooks/use-public-branches";
import type { StepSpouseData } from "./step-spouse";

export interface StepOneData {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  birthdate: string;
  gender: string;
  civil_status: string;
  branch_id: string;
}

interface Props {
  data: StepOneData;
  errors: Partial<Record<keyof StepOneData, string>>;
  onChange: <K extends keyof StepOneData>(field: K, value: StepOneData[K]) => void;
  spouse: StepSpouseData;
  onSpouseChange: <K extends keyof StepSpouseData>(
    field: K,
    value: StepSpouseData[K]
  ) => void;
  onNext: () => void;
}

export function StepPersonal({
  data,
  errors,
  onChange,
  spouse,
  onSpouseChange,
  onNext,
}: Props) {
  const { branches, loading: branchesLoading, error: branchesError } = usePublicBranches();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first_name">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="first_name"
            placeholder="Juan"
            value={data.first_name}
            onChange={(e) => onChange("first_name", e.target.value)}
            className={errors.first_name ? "border-destructive" : ""}
          />
          {errors.first_name && (
            <p className="text-xs text-destructive">{errors.first_name}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="last_name"
            placeholder="Santos"
            value={data.last_name}
            onChange={(e) => onChange("last_name", e.target.value)}
            className={errors.last_name ? "border-destructive" : ""}
          />
          {errors.last_name && (
            <p className="text-xs text-destructive">{errors.last_name}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="middle_name">Middle Name</Label>
          <Input
            id="middle_name"
            placeholder="Dela Cruz"
            value={data.middle_name}
            onChange={(e) => onChange("middle_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Suffix</Label>
          <Select
            value={data.suffix || null}
            onValueChange={(v) => onChange("suffix", v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None">
                {(value: string | null) =>
                  value
                    ? (SUFFIX_OPTIONS.find(
                        (o) => (o.value || "none") === value
                      )?.label ?? value)
                    : "None"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUFFIX_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="birthdate">
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Input
            id="birthdate"
            type="date"
            value={data.birthdate}
            onChange={(e) => onChange("birthdate", e.target.value)}
            className={errors.birthdate ? "border-destructive" : ""}
          />
          {errors.birthdate && (
            <p className="text-xs text-destructive">{errors.birthdate}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>
            Civil Status <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.civil_status || null}
            onValueChange={(v) => onChange("civil_status", v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status">
                {(value: string | null) =>
                  value
                    ? (CIVIL_STATUS_OPTIONS.find((o) => o.value === value)
                        ?.label ?? value)
                    : "Select status"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CIVIL_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.civil_status && (
            <p className="text-xs text-destructive">{errors.civil_status}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>
            Gender <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            className="flex gap-6 pt-1"
            value={data.gender || null}
            onValueChange={(v) => onChange("gender", v ?? "")}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="male" />
              <span className="text-sm">Male</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="female" />
              <span className="text-sm">Female</span>
            </label>
          </RadioGroup>
          {errors.gender && (
            <p className="text-xs text-destructive">{errors.gender}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>
            Preferred Branch
            {!branchesError && <span className="text-destructive"> *</span>}
          </Label>
          <Select
            value={data.branch_id || null}
            onValueChange={(v) => onChange("branch_id", v ?? "")}
            disabled={branchesLoading || !!branchesError}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  branchesLoading
                    ? "Loading branches…"
                    : branchesError
                    ? "Branches unavailable — admin will assign"
                    : "Select a branch"
                }
              >
                {(value: string | null) => {
                  const selected = branches.find((b) => String(b.id) === value);
                  return selected
                    ? selected.city
                      ? `${selected.name} — ${selected.city}`
                      : selected.name
                    : branchesLoading
                    ? "Loading branches…"
                    : branchesError
                    ? "Branches unavailable — admin will assign"
                    : "Select a branch";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.city ? `${b.name} — ${b.city}` : b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.branch_id && !branchesError && (
            <p className="text-xs text-destructive">{errors.branch_id}</p>
          )}
          {branchesError && (
            <p className="text-xs text-muted-foreground">
              Branch list is temporarily unavailable. You can continue — an admin
              will assign your branch during review.
            </p>
          )}
        </div>
      </div>

      {data.civil_status === "married" && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Spouse Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="spouse_first_name">First Name</Label>
              <Input
                id="spouse_first_name"
                placeholder="First name"
                value={spouse.spouse_first_name}
                onChange={(e) => onSpouseChange("spouse_first_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spouse_middle_name">Middle Name</Label>
              <Input
                id="spouse_middle_name"
                placeholder="Middle name"
                value={spouse.spouse_middle_name}
                onChange={(e) => onSpouseChange("spouse_middle_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spouse_last_name">Last Name</Label>
              <Input
                id="spouse_last_name"
                placeholder="Last name"
                value={spouse.spouse_last_name}
                onChange={(e) => onSpouseChange("spouse_last_name", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="spouse_contact_number">Contact Number</Label>
              <Input
                id="spouse_contact_number"
                type="tel"
                placeholder="09XXXXXXXXX"
                value={spouse.spouse_contact_number}
                onChange={(e) =>
                  onSpouseChange("spouse_contact_number", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spouse_occupation">Occupation</Label>
              <Input
                id="spouse_occupation"
                placeholder="Occupation or employer"
                value={spouse.spouse_occupation}
                onChange={(e) => onSpouseChange("spouse_occupation", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-border">
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
