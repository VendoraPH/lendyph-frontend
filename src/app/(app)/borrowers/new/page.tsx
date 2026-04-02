"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

import { borrowerService } from "@/services/borrower.service";
import { branchService, type ApiBranch } from "@/services/branch.service";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS } from "@/constants";

interface BorrowerFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  birthdate: string;
  gender: string;
  civil_status: string;
  contact_number: string;
  email: string;
  address: string;
  employer_or_business: string;
  monthly_income: string;
  branch_id: string;
}

function emptyForm(): BorrowerFormData {
  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    birthdate: "",
    gender: "",
    civil_status: "",
    contact_number: "",
    email: "",
    address: "",
    employer_or_business: "",
    monthly_income: "",
    branch_id: "",
  };
}

export default function NewBorrowerPage() {
  const router = useRouter();
  const [form, setForm] = useState<BorrowerFormData>(emptyForm());
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await branchService.list();
        const list = Array.isArray(res) ? res : (res as unknown as { data: ApiBranch[] }).data ?? [];
        setBranches(list.filter((b) => b.is_active));
      } catch {
        toast.error("Failed to load branches");
      }
    }
    fetchBranches();
  }, []);

  function update<K extends keyof BorrowerFormData>(field: K, value: BorrowerFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const clientErrors: Record<string, string[]> = {};
    if (!form.first_name.trim()) clientErrors.first_name = ["First name is required"];
    if (!form.last_name.trim()) clientErrors.last_name = ["Last name is required"];
    if (!form.branch_id) clientErrors.branch_id = ["Branch is required"];

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        branch_id: Number(form.branch_id),
      };

      // Only include optional fields if they have values
      if (form.middle_name.trim()) payload.middle_name = form.middle_name.trim();
      if (form.suffix && form.suffix !== "none") payload.suffix = form.suffix;
      if (form.birthdate) payload.birthdate = form.birthdate;
      if (form.gender) payload.gender = form.gender;
      if (form.civil_status) payload.civil_status = form.civil_status;
      if (form.contact_number.trim()) payload.contact_number = form.contact_number.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.employer_or_business.trim()) payload.employer_or_business = form.employer_or_business.trim();
      if (form.monthly_income) payload.monthly_income = Number(form.monthly_income);

      await borrowerService.create(payload as Parameters<typeof borrowerService.create>[0]);
      toast.success("Borrower created successfully");
      router.push("/borrowers");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (apiError?.response?.data?.errors) {
        setErrors(apiError.response.data.errors);
        toast.error("Please fix the validation errors below");
      } else if (apiError?.response?.data?.message) {
        toast.error(apiError.response.data.message);
      } else {
        toast.error("Failed to create borrower");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(field: string) {
    if (!errors[field]?.length) return null;
    return (
      <p className="text-xs text-destructive mt-1">{errors[field]![0]}</p>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/borrowers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Borrowers
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add New Borrower</h1>
        <p className="text-sm text-muted-foreground">
          Create a new borrower profile
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Personal Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="first_name"
                  placeholder="Juan"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                />
                {fieldError("first_name")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="last_name"
                  placeholder="Santos"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                />
                {fieldError("last_name")}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input
                  id="middle_name"
                  placeholder="Dela Cruz"
                  value={form.middle_name}
                  onChange={(e) => update("middle_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Suffix</Label>
                <Select
                  value={form.suffix}
                  onValueChange={(v) => update("suffix", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
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
              <div className="space-y-2">
                <Label htmlFor="birthdate">Birthdate</Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => update("birthdate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <RadioGroup
                  className="flex gap-4 pt-2"
                  value={form.gender}
                  onValueChange={(v) => update("gender", v ?? "")}
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
              </div>
            </div>

            <div className="space-y-2">
              <Label>Civil Status</Label>
              <Select
                value={form.civil_status}
                onValueChange={(v) => update("civil_status", v ?? "")}
              >
                <SelectTrigger className="w-full sm:w-1/2">
                  <SelectValue placeholder="Select civil status" />
                </SelectTrigger>
                <SelectContent>
                  {CIVIL_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Contact Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={form.contact_number}
                  onChange={(e) => update("contact_number", e.target.value)}
                />
                {fieldError("contact_number")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
                {fieldError("email")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Full address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Employment & Income */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Employment & Income</h2>

            <div className="space-y-2">
              <Label htmlFor="employer_or_business">Employer / Business Name</Label>
              <Input
                id="employer_or_business"
                placeholder="Company or business name"
                value={form.employer_or_business}
                onChange={(e) => update("employer_or_business", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_income">Monthly Income (PHP)</Label>
              <Input
                id="monthly_income"
                type="number"
                min={0}
                step={100}
                placeholder="0"
                value={form.monthly_income}
                onChange={(e) => update("monthly_income", e.target.value)}
              />
              {fieldError("monthly_income")}
            </div>
          </CardContent>
        </Card>

        {/* Branch Assignment */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Branch Assignment</h2>

            <div className="space-y-2">
              <Label>
                Branch <span className="text-destructive">*</span>
              </Label>
              {branches.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Spinner className="size-4" />
                  Loading branches...
                </div>
              ) : (
                <Select
                  value={form.branch_id ? String(form.branch_id) : ""}
                  onValueChange={(v) => update("branch_id", v ?? "")}
                >
                  <SelectTrigger className="w-full sm:w-1/2">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fieldError("branch_id")}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <Link
            href="/borrowers"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            {submitting ? (
              <>
                <Spinner className="size-4 mr-2" />
                Creating...
              </>
            ) : (
              "Create Borrower"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
