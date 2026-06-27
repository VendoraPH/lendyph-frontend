// src/app/(public)/register/page.tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "./_components/step-indicator";
import { StepPersonal, type StepOneData } from "./_components/step-personal";
import { StepContact, type StepTwoData } from "./_components/step-contact";
import type { StepSpouseData } from "./_components/step-spouse";
import { StepPhotoIds, type ValidIdEntry } from "./_components/step-photo-ids";
import { StepEmployment, type StepEmploymentData } from "./_components/step-employment";
import { StepReview } from "./_components/step-review";
import { registrationService } from "@/services/registration.service";
import { usePublicBranches } from "@/hooks/use-public-branches";
import { compressImage } from "@/lib/image-compress";

const STEP_LABELS = [
  "Personal Info",
  "Contact & Address",
  "Photo & IDs",
  "Employment",
  "Review",
];

type FullErrors = Partial<
  Record<
    keyof StepOneData | keyof StepTwoData | keyof StepSpouseData | keyof StepEmploymentData,
    string
  >
>;

function emptyPersonal(): StepOneData {
  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    birthdate: "",
    gender: "",
    civil_status: "",
    branch_id: "",
  };
}

function emptyContact(): StepTwoData {
  return {
    contact_number: "",
    email: "",
    address: "",
    barangay: "",
    city: "",
    province: "",
  };
}

function emptySpouse(): StepSpouseData {
  return {
    spouse_first_name: "",
    spouse_middle_name: "",
    spouse_last_name: "",
    spouse_contact_number: "",
    spouse_occupation: "",
  };
}

function emptyEmployment(): StepEmploymentData {
  return {
    employer_or_business: "",
    date_hired: "",
    monthly_income: "",
    pledge_amount: "",
  };
}

function validatePersonal(d: StepOneData): Partial<Record<keyof StepOneData, string>> {
  const errs: Partial<Record<keyof StepOneData, string>> = {};
  if (!d.first_name.trim()) errs.first_name = "First name is required";
  if (!d.last_name.trim()) errs.last_name = "Last name is required";
  if (!d.birthdate) errs.birthdate = "Date of birth is required";
  if (!d.civil_status) errs.civil_status = "Civil status is required";
  if (!d.gender) errs.gender = "Gender is required";
  // middle_name is optional — many applicants don't have one.
  // branch_id is intentionally not enforced here: if the public /branches
  // endpoint is down or branch list is empty, admin will assign during
  // review. The submit payload only includes branch_id when a value is set.
  return errs;
}

function validateContact(d: StepTwoData): Partial<Record<keyof StepTwoData, string>> {
  const errs: Partial<Record<keyof StepTwoData, string>> = {};
  if (!d.contact_number.trim()) {
    errs.contact_number = "Contact number is required";
  } else if (!/^(\+?\d{7,15}|0\d{9,10})$/.test(d.contact_number.trim())) {
    // Mirror the backend regex so the user fixes a bad number here, not on submit.
    errs.contact_number = "Enter a valid phone number (e.g., 09171234567 or +639171234567)";
  }
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) {
    errs.email = "Enter a valid email address";
  }
  if (!d.address.trim()) errs.address = "Street address is required";
  if (!d.city.trim()) errs.city = "City / Municipality is required";
  if (!d.province.trim()) errs.province = "Province is required";
  return errs;
}

// Extract a human-readable reason from an Axios error so the user sees
// the real backend complaint (e.g. "The branch id field is required.")
// instead of a generic "check your connection" message that hides the
// actual cause. Falls back to the caller-supplied fallback string when
// the error didn't come from the server.
function submissionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;
    const firstFieldError = data?.errors
      ? Object.values(data.errors).flat()[0]
      : undefined;
    const serverMsg = firstFieldError || data?.message;
    if (status === 401) return "Your session has expired. Please refresh the page.";
    if (status === 403) return "You don't have permission to submit this form.";
    if (status === 413) return "Uploaded file is too large.";
    if (status === 429) {
      const retryAfter = Number(err.response?.headers?.["retry-after"]);
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? ` Please try again in about ${Math.ceil(retryAfter / 10) * 10} seconds.`
        : " Please try again in a minute.";
      return `Too many submission attempts.${wait}`;
    }
    if (status === 422 && serverMsg) return serverMsg;
    if (serverMsg) return serverMsg;
  }
  return fallback;
}

function validateEmployment(
  d: StepEmploymentData
): Partial<Record<keyof StepEmploymentData, string>> {
  const errs: Partial<Record<keyof StepEmploymentData, string>> = {};
  if (d.monthly_income && Number(d.monthly_income) < 0) {
    errs.monthly_income = "Monthly income cannot be negative";
  }
  if (d.pledge_amount && Number(d.pledge_amount) < 0) {
    errs.pledge_amount = "Pledge amount cannot be negative";
  }
  // en-CA renders local time as YYYY-MM-DD, so a plain string compare works.
  if (d.date_hired && d.date_hired > new Date().toLocaleDateString("en-CA")) {
    errs.date_hired = "Date hired cannot be in the future";
  }
  return errs;
}

export default function RegisterPage() {
  const router = useRouter();
  const { branches } = usePublicBranches();
  const [step, setStep] = useState(1);

  const [personal, setPersonal] = useState<StepOneData>(emptyPersonal());
  const [contact, setContact] = useState<StepTwoData>(emptyContact());
  const [spouse, setSpouse] = useState<StepSpouseData>(emptySpouse());
  const [employment, setEmployment] = useState<StepEmploymentData>(emptyEmployment());

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [validIds, setValidIds] = useState<ValidIdEntry[]>([]);

  // Once the borrower record is created we keep its id/token so a resubmit
  // (after a partial upload failure) reuses it instead of creating a duplicate.
  const [created, setCreated] = useState<{ id: number; token?: string } | null>(null);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  const [errors, setErrors] = useState<FullErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isMarried = personal.civil_status === "married";

  function clearError<K extends keyof FullErrors>(field: K) {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function updatePersonal<K extends keyof StepOneData>(field: K, value: StepOneData[K]) {
    setPersonal((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  }

  function updateContact<K extends keyof StepTwoData>(field: K, value: StepTwoData[K]) {
    setContact((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  }

  function updateSpouse<K extends keyof StepSpouseData>(field: K, value: StepSpouseData[K]) {
    setSpouse((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  }

  function updateEmployment<K extends keyof StepEmploymentData>(
    field: K,
    value: StepEmploymentData[K]
  ) {
    setEmployment((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  }

  function handlePhotoChange(file: File | null, preview: string | null) {
    setPhotoFile(file);
    setPhotoPreview(preview);
  }

  function goToStep(target: number) {
    setStep(Math.max(1, Math.min(STEP_LABELS.length, target)));
  }

  function handleNextPersonal() {
    const errs = validatePersonal(personal);
    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }));
      return;
    }
    goToStep(2);
  }

  function handleNextContact() {
    const errs = validateContact(contact);
    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }));
      return;
    }
    goToStep(3);
  }

  function handleNextPhotoIds() {
    // KYC: at least one valid ID (with a front photo) is required before review.
    // Mirrors the backend gate that blocks approving a registration with no ID.
    const hasUsableId = validIds.some(
      (v) =>
        v.uploaded ||
        (v.type &&
          v.front_file &&
          (v.type !== "others" || v.custom_type_name.trim()))
    );
    if (!hasUsableId) {
      toast.error(
        "Please add at least one valid ID (with a front photo) before continuing."
      );
      return;
    }
    goToStep(4);
  }

  function handleNextEmployment() {
    const errs = validateEmployment(employment);
    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }));
      return;
    }
    goToStep(5);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Create the borrower once. On a resubmit after a partial upload failure
      // we reuse the existing record rather than creating a duplicate.
      let borrowerId = created?.id;
      let token = created?.token;
      if (!borrowerId) {
        const result = await registrationService.submit({
          first_name: personal.first_name.trim(),
          middle_name: personal.middle_name.trim() || undefined,
          last_name: personal.last_name.trim(),
          suffix:
            personal.suffix && personal.suffix !== "none" ? personal.suffix : undefined,
          birthdate: personal.birthdate,
          gender: personal.gender,
          civil_status: personal.civil_status,
          contact_number: contact.contact_number.trim(),
          email: contact.email.trim() || undefined,
          address: contact.address.trim(),
          barangay: contact.barangay.trim() || undefined,
          city: contact.city.trim(),
          province: contact.province.trim(),
          branch_id: personal.branch_id ? Number(personal.branch_id) : undefined,
          employer_or_business: employment.employer_or_business.trim() || undefined,
          date_hired: employment.date_hired || undefined,
          monthly_income: employment.monthly_income
            ? Number(employment.monthly_income)
            : undefined,
          pledge_amount: employment.pledge_amount ? Number(employment.pledge_amount) : 0,
          spouse_first_name: isMarried
            ? spouse.spouse_first_name.trim() || undefined
            : undefined,
          spouse_middle_name: isMarried
            ? spouse.spouse_middle_name.trim() || undefined
            : undefined,
          spouse_last_name: isMarried
            ? spouse.spouse_last_name.trim() || undefined
            : undefined,
          spouse_contact_number: isMarried
            ? spouse.spouse_contact_number.trim() || undefined
            : undefined,
          spouse_occupation: isMarried
            ? spouse.spouse_occupation.trim() || undefined
            : undefined,
          status: "pending",
        });
        borrowerId = result.id;
        token = result.submission_token;
        setCreated({ id: borrowerId, token });
      }

      const uploadErrors: string[] = [];

      // Upload profile photo. Idempotent (replaces), so safe to retry.
      if (photoFile && borrowerId && !photoUploaded) {
        try {
          const fd = new FormData();
          fd.append("photo", await compressImage(photoFile));
          await registrationService.uploadPhoto(borrowerId, fd, token);
          setPhotoUploaded(true);
        } catch (err) {
          uploadErrors.push(
            submissionErrorMessage(err, "Profile photo upload failed.")
          );
        }
      }

      // Upload valid IDs — same filter rules as admin /borrowers/new. Skip any
      // already uploaded on a prior attempt to avoid duplicate ID records.
      const idsToUpload = validIds.filter(
        (v) =>
          !v.uploaded &&
          v.type &&
          (v.front_file || v.back_file) &&
          (v.type !== "others" || v.custom_type_name.trim())
      );
      for (const entry of idsToUpload) {
        try {
          const fd = new FormData();
          fd.append("type", entry.type);
          if (entry.type === "others" && entry.custom_type_name.trim()) {
            fd.append("custom_type_name", entry.custom_type_name.trim());
          }
          if (entry.id_number.trim()) fd.append("id_number", entry.id_number.trim());
          if (entry.front_file) fd.append("front_file", await compressImage(entry.front_file));
          if (entry.back_file) fd.append("back_file", await compressImage(entry.back_file));
          await registrationService.uploadValidId(borrowerId, fd, token);
          setValidIds((prev) =>
            prev.map((v) => (v === entry ? { ...v, uploaded: true } : v))
          );
        } catch (err) {
          uploadErrors.push(
            submissionErrorMessage(err, `Failed to upload ${entry.type} ID`)
          );
        }
      }

      // Do not advance to the success page if any upload failed — surface the
      // error and keep the user here so they can fix the file and resubmit.
      if (uploadErrors.length) {
        toast.error(uploadErrors[0]);
        return;
      }

      router.push("/register/success");
    } catch (err) {
      toast.error(
        submissionErrorMessage(
          err,
          "Submission failed. Please check your connection and try again."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Spouse fields render inline inside step 1 when married, so the step
  // indicator stays at 4 fixed steps regardless of civil status.
  const visibleLabels = STEP_LABELS;
  const visibleStep = step;

  return (
    <div className="px-4 py-6 sm:py-8">
      {/* Logo bar */}
      <div className="flex justify-center mb-4">
        <div className="flex items-center gap-2.5">
          <Image src="/Logo/binhs logo.png" alt="Lendy.PH" width={360} height={144} className="h-36 w-auto" />
        </div>
      </div>

      {/* Page heading */}
      <div className="text-center mb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mb-1.5">
          Online Membership Application
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Complete the form below to apply for membership. Our team will review your
          application and contact you.
        </p>
      </div>

      {/* Info banner */}
      <div className="max-w-3xl mx-auto mb-4">
        <div className="flex gap-3 items-start rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-2.5">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Make sure to enter your details accurately. Our staff will verify your
            information before your membership is activated. Processing takes 1–3
            business days.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={visibleStep} labels={visibleLabels} />

      {/* Form card */}
      <Card className="max-w-3xl mx-auto shadow-md">
        <CardContent className="pt-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-orange mb-4">
            Step {visibleStep} of {visibleLabels.length} —{" "}
            {visibleLabels[visibleStep - 1]}
          </p>

          {step === 1 && (
            <StepPersonal
              data={personal}
              errors={errors as Partial<Record<keyof StepOneData, string>>}
              onChange={updatePersonal}
              spouse={spouse}
              onSpouseChange={updateSpouse}
              onNext={handleNextPersonal}
            />
          )}
          {step === 2 && (
            <StepContact
              data={contact}
              errors={errors as Partial<Record<keyof StepTwoData, string>>}
              onChange={updateContact}
              onNext={handleNextContact}
              onBack={() => goToStep(1)}
            />
          )}
          {step === 3 && (
            <StepPhotoIds
              photoPreview={photoPreview}
              validIds={validIds}
              onPhotoChange={handlePhotoChange}
              onValidIdsChange={setValidIds}
              onNext={handleNextPhotoIds}
              onBack={() => goToStep(2)}
            />
          )}
          {step === 4 && (
            <StepEmployment
              employment={employment}
              errors={errors as Partial<Record<keyof StepEmploymentData, string>>}
              onChange={updateEmployment}
              onNext={handleNextEmployment}
              onBack={() => goToStep(3)}
            />
          )}
          {step === 5 && (
            <StepReview
              personal={personal}
              contact={contact}
              spouse={spouse}
              employment={employment}
              photoPreview={photoPreview}
              validIds={validIds}
              branches={branches}
              onSubmit={handleSubmit}
              onBack={() => goToStep(4)}
              submitting={submitting}
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
