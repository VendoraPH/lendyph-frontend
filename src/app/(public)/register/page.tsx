// src/app/(public)/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "./_components/step-indicator";
import { StepPersonal, type StepOneData } from "./_components/step-personal";
import { StepContact, type StepTwoData } from "./_components/step-contact";
import { StepReview } from "./_components/step-review";
import { registrationService } from "@/services/registration.service";

const STEP_LABELS = ["Personal Info", "Contact & Address", "Review & Submit"];

type FormData = StepOneData & StepTwoData;

function emptyForm(): FormData {
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
    barangay: "",
    city: "",
    province: "",
  };
}

function validateStep1(data: StepOneData): Partial<Record<keyof StepOneData, string>> {
  const errs: Partial<Record<keyof StepOneData, string>> = {};
  if (!data.first_name.trim()) errs.first_name = "First name is required";
  if (!data.middle_name.trim()) errs.middle_name = "Middle name is required";
  if (!data.last_name.trim()) errs.last_name = "Last name is required";
  if (!data.birthdate) errs.birthdate = "Date of birth is required";
  if (!data.civil_status) errs.civil_status = "Civil status is required";
  if (!data.gender) errs.gender = "Gender is required";
  return errs;
}

function validateStep2(data: StepTwoData): Partial<Record<keyof StepTwoData, string>> {
  const errs: Partial<Record<keyof StepTwoData, string>> = {};
  if (!data.contact_number.trim()) errs.contact_number = "Contact number is required";
  if (!data.address.trim()) errs.address = "Street address is required";
  if (!data.city.trim()) errs.city = "City / Municipality is required";
  if (!data.province.trim()) errs.province = "Province is required";
  return errs;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  }

  function handleNextStep1() {
    const errs = validateStep1(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(2);
  }

  function handleNextStep2() {
    const errs = validateStep2(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(3);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await registrationService.submit({
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        suffix: form.suffix && form.suffix !== "none" ? form.suffix : undefined,
        birthdate: form.birthdate,
        gender: form.gender,
        civil_status: form.civil_status,
        contact_number: form.contact_number.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim(),
        barangay: form.barangay.trim() || undefined,
        city: form.city.trim(),
        province: form.province.trim(),
      });
      router.push("/register/success");
    } catch {
      toast.error("Submission failed. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-10 sm:py-14">
      {/* Logo bar */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo/Lendy_logo.png" alt="Lendy.PH" className="h-8 w-auto" />
        </div>
      </div>

      {/* Page heading */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
          Online Membership Application
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Complete the form below to apply for membership. Our team will review your
          application and contact you.
        </p>
      </div>

      {/* Info banner */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="flex gap-3 items-start rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Make sure to enter your details accurately. Our staff will verify your
            information before your membership is activated. Processing takes 1–3
            business days.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} labels={STEP_LABELS} />

      {/* Form card */}
      <Card className="max-w-lg mx-auto shadow-md">
        <CardContent className="pt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-orange mb-5">
            Step {step} of {STEP_LABELS.length} — {STEP_LABELS[step - 1]}
          </p>

          {step === 1 && (
            <StepPersonal
              data={form}
              errors={errors}
              onChange={update}
              onNext={handleNextStep1}
            />
          )}
          {step === 2 && (
            <StepContact
              data={form}
              errors={errors}
              onChange={update}
              onNext={handleNextStep2}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepReview
              data={form}
              submitting={submitting}
              onSubmit={handleSubmit}
              onBack={() => setStep(2)}
            />
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-6">
        © {new Date().getFullYear()} Lendy.PH · All rights reserved
      </p>
    </div>
  );
}
