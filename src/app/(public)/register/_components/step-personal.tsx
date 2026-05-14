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

export interface StepOneData {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  birthdate: string;
  gender: string;
  civil_status: string;
}

interface Props {
  data: StepOneData;
  errors: Partial<Record<keyof StepOneData, string>>;
  onChange: <K extends keyof StepOneData>(field: K, value: StepOneData[K]) => void;
  onNext: () => void;
}

export function StepPersonal({ data, errors, onChange, onNext }: Props) {
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
          <Label htmlFor="middle_name">
            Middle Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="middle_name"
            placeholder="Dela Cruz"
            value={data.middle_name}
            onChange={(e) => onChange("middle_name", e.target.value)}
            className={errors.middle_name ? "border-destructive" : ""}
          />
          {errors.middle_name && (
            <p className="text-xs text-destructive">{errors.middle_name}</p>
          )}
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
