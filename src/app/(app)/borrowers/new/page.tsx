"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RouteGuard } from "@/components/common";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, FileText, ImageIcon, Plus, X, SwitchCamera } from "lucide-react";
import { toast } from "sonner";
import { notifyError, notifyValidation } from "@/lib/notify";
import { isDuplicateNameMessage } from "@/lib/duplicate-error";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { MAX_PER_PAGE } from "@/lib/paginate";
import { IdCropDialog } from "@/components/borrower/id-crop-dialog";
import { Crop as CropIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PhotoCropDialog } from "@/components/borrower/photo-crop-dialog";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS, VALID_ID_OPTIONS } from "@/constants";

// Last-resort copy for the duplicate dialog when NONE of name/code/birthdate
// could be parsed out of the backend's 422. Without this the admin gets a
// bordered empty box under "Review the match before creating a new account" —
// told there is a match and shown nothing to review.
//
// This is reachable, not theoretical: `NoDuplicateBorrower` has a second,
// detail-free message for callers who may not see who matched — "A similar
// borrower already exists. Please contact your branch to continue." — which
// satisfies `isDuplicateNameMessage` (it contains "already exists") but offers
// the parser no name, no code and no `born` date.
//
// The trailing "Pass force=true to create anyway." is an internal hint that is
// deliberately never shown to operators (`looksHuman` in @/lib/api-error
// rejects any message carrying it), so it is stripped here rather than passed
// through. Kept local instead of in src/lib because it exists solely for this
// dialog's fallback.
function duplicateFallbackText(rawMessage: string): string | null {
  const cleaned = rawMessage
    .replace(/\s*Pass force=true to create anyway\.?/i, "")
    .trim();
  return cleaned || null;
}

interface ValidIdEntry {
  type: string;
  // Populated only when type === "others" — free-text label for custom IDs
  // not covered by VALID_ID_OPTIONS (e.g., Senior Citizen ID, school ID).
  custom_type_name: string;
  id_number: string;
  front_file: File | null;
  front_preview: string | null;
  back_file: File | null;
  back_preview: string | null;
}

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
  barangay: string;
  city: string;
  province: string;
  employer_or_business: string;
  monthly_income: string;
  branch_id: string;
  pledge_amount: string;
  spouse_first_name: string;
  spouse_middle_name: string;
  spouse_last_name: string;
  spouse_contact_number: string;
  spouse_occupation: string;
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
    barangay: "",
    city: "",
    province: "",
    employer_or_business: "",
    monthly_income: "",
    pledge_amount: "",
    branch_id: "",
    spouse_first_name: "",
    spouse_middle_name: "",
    spouse_last_name: "",
    spouse_contact_number: "",
    spouse_occupation: "",
  };
}

export default function NewBorrowerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<BorrowerFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  // Surface the backend's Levenshtein/birthdate duplicate detection as a
  // confirmation dialog instead of leaking "Pass force=true to create
  // anyway" through the field-errors panel. See handleSubmit for wiring.
  const [duplicateMatch, setDuplicateMatch] = useState<{
    code?: string;
    birthdate?: string;
    fullName?: string;
    // Human-readable reason why this was flagged as a potential duplicate.
    // Populated by the client-side pre-check; absent for backend responses.
    matchReason?: string;
    // Raw backend error message when the 422 path fires; empty string when
    // the client-side check fires.
    rawMessage: string;
  } | null>(null);
  // Running the pre-check is a list fetch, not instant. Show a spinner on
  // the submit button while it's in flight so the form doesn't feel stuck.
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [creatingAnyway, setCreatingAnyway] = useState(false);

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Photo crop dialog — opened after a file is chosen (upload or camera) so
  // the user can drag/zoom to position the image the way they want it.
  const [photoCropOpen, setPhotoCropOpen] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  // Camera capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Valid IDs
  const [validIds, setValidIds] = useState<ValidIdEntry[]>([]);
  const [cropTarget, setCropTarget] = useState<{ index: number; side: "front" | "back"; src: string } | null>(null);

  // Auto-assign branch from the currently signed-in user. Members inherit
  // the branch of whoever creates them, so there's no manual selector.
  useEffect(() => {
    const branchId = user?.branch?.id;
    if (branchId) {
      setForm((prev) =>
        prev.branch_id === String(branchId) ? prev : { ...prev, branch_id: String(branchId) }
      );
    }
  }, [user?.branch?.id]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPhotoFile(file);
    setPhotoCropOpen(true);
    // Allow re-selecting the same file later
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function handlePhotoCropComplete(blob: Blob) {
    const file = new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    setPhotoCropOpen(false);
    setPendingPhotoFile(null);
  }

  function removePhoto() {
    setProfilePhoto(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const startCamera = useCallback(async (facing: "user" | "environment") => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Unable to access camera. Check browser permissions.");
      setCameraOpen(false);
    }
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function openCamera() {
    setCameraOpen(true);
    // Camera starts via useEffect when dialog opens
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Crop to center square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
      setCameraOpen(false);
      stopCamera();
      // Open the crop dialog so the user can position the capture as they
      // prefer before it becomes the profile photo.
      setPendingPhotoFile(file);
      setPhotoCropOpen(true);
    }, "image/jpeg", 0.9);
  }

  function handleCameraDialogChange(open: boolean) {
    setCameraOpen(open);
    if (!open) stopCamera();
  }

  function toggleFacingMode() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startCamera(next);
  }

  // Start camera when dialog opens
  useEffect(() => {
    if (cameraOpen) {
      startCamera(facingMode);
    }
    return () => { if (!cameraOpen) stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  function addValidId() {
    setValidIds((prev) => [...prev, {
      type: "",
      custom_type_name: "",
      id_number: "",
      front_file: null,
      front_preview: null,
      back_file: null,
      back_preview: null,
    }]);
  }

  function updateValidId(index: number, field: keyof ValidIdEntry, value: unknown) {
    setValidIds((prev) => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  }

  function handleValidIdFile(index: number, side: "front" | "back", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setValidIds((prev) => prev.map((entry, i) =>
        i === index
          ? side === "front"
            ? { ...entry, front_file: file, front_preview: reader.result as string }
            : { ...entry, back_file: file, back_preview: reader.result as string }
          : entry
      ));
    };
    reader.readAsDataURL(file);
  }

  function removeValidId(index: number) {
    setValidIds((prev) => prev.filter((_, i) => i !== index));
  }

  function update<K extends keyof BorrowerFormData>(field: K, value: BorrowerFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // A missing branch means the signed-in user isn't assigned to one — a
    // configuration problem, not something the operator can fix on this form.
    if (!form.branch_id) {
      toast.error("Your account is not assigned to a branch. Contact an administrator.");
      return;
    }

    // Client-side validation — collect human labels for every empty required
    // field and surface them in a single consolidated toast.
    const missing: string[] = [];
    if (!form.first_name.trim()) missing.push("First name");
    if (!form.last_name.trim()) missing.push("Last name");
    // middle_name is deliberately NOT required. The backend has it nullable, the
    // client's Guidelines sheet says to leave it blank when the member has none,
    // and the public registration form already allows that. Requiring it here
    // only diverged from every other source of truth.
    if (!form.birthdate) missing.push("Date of birth");
    if (!form.gender) missing.push("Gender");
    if (!form.civil_status) missing.push("Civil status");
    if (!form.contact_number.trim()) missing.push("Contact number");
    if (!form.address.trim()) missing.push("Street address");
    if (!form.city.trim()) missing.push("City / Municipality");
    if (!form.province.trim()) missing.push("Province");

    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }

    // Tiered duplicate detection (client-side first, backend as safety net).
    //
    // The backend Levenshtein+birthdate matcher misses cases where the
    // typist misspells ONE name and the birthdate also differs slightly —
    // but the rest of the identity (phone/email/address/civil status) is
    // clearly the same person. Per the original feature spec:
    //   1. If all 3 names (first + middle + last) match exactly → duplicate.
    //   2. If 2 of 3 names match AND at least 2 other identity fields
    //      (birthdate, gender, civil status, phone, email, address) also
    //      match → duplicate.
    // Backend still runs its own check on submit; if this client-side pass
    // misses, the 422 path will catch it and use the same dialog.
    setCheckingDuplicate(true);
    try {
      const match = await preCheckDuplicate();
      if (match) {
        setDuplicateMatch({ ...match, rawMessage: "" });
        return;
      }
    } finally {
      setCheckingDuplicate(false);
    }

    await submitBorrower(false);
  }

  // Tiered client-side duplicate check. Returns the matched borrower +
  // reason when either name tier fires, or null when the applicant looks
  // clean. All comparisons are case- and whitespace-normalized.
  async function preCheckDuplicate() {
    const normalize = (s: string | undefined | null) =>
      (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
    const firstN = normalize(form.first_name);
    const middleN = normalize(form.middle_name);
    const lastN = normalize(form.last_name);
    if (!firstN || !lastN) return null;

    type Candidate = Record<string, unknown> & {
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      full_name?: string;
      borrower_code?: string;
      birthdate?: string;
      gender?: string;
      civil_status?: string;
      contact_number?: string;
      phone?: string;
      email?: string;
      address?: string;
    };

    let list: Candidate[] = [];
    try {
      // Wider per_page than a typed page because the list endpoint returns
      // the first N matches of the search string — surnames like "Dela Cruz"
      // easily fill a small page.
      //
      // MAX_PER_PAGE (100), not a hand-picked 50: the 50 was already serving
      // the intent above — "as many candidates as we can get in one request" —
      // it was just guessing at what that meant. 100 is the actual ceiling
      // (`BorrowerController::index()` does `min(per_page, 100)`), so this is
      // twice the candidate pool for the same single request, and the number
      // now names the constraint instead of a preference.
      //
      // Deliberately NOT drained, and this is the one `per_page` on this branch
      // that should stay a single request. It is a soft pre-flight warning, not
      // a gate: it runs on submit, and `borrowers:create` on the API is what
      // actually refuses a duplicate — see the catch below, which swallows a
      // network failure and lets the backend decide precisely because this is
      // advisory. Draining every "Dela Cruz" in the co-op to raise a dialog the
      // user can click through would be a request storm in exchange for a
      // slightly better hint.
      //
      // What it costs: a true duplicate sitting past the hundredth match for
      // this name is not warned about client-side. That is a missed warning,
      // not a missed check.
      //
      // SEARCH ON THE SURNAME ALONE, never "First Last". `Borrower::scopeSearch`
      // LIKEs the WHOLE term against each column separately
      // (`first_name LIKE %term% OR middle_name LIKE %term% OR last_name ...`),
      // so a two-word term can only match if ONE column contains both words —
      // which no name column ever does. This previously sent
      // `"${first} ${last}"` and therefore came back empty for every applicant,
      // making Tier A and Tier B below unreachable dead code. Verified against a
      // live API: "Fixture" -> 1 row, "Lockout9001" -> 1 row,
      // "Fixture Lockout9001" -> 0 rows, and the exact full name -> 0 rows.
      //
      // The surname is the most selective single token available, and the
      // tiering below already re-checks first/middle/last individually in JS,
      // so a broader candidate set costs nothing in precision.
      //
      // What this still cannot catch: a MISSPELLED surname. Tier B exists for
      // one-name typos, and a typo in the very field being searched will not
      // return the candidate. First/middle typos — the case Tier B was written
      // for — are covered.
      const res = await borrowerService.list({
        search: form.last_name.trim(),
        per_page: MAX_PER_PAGE,
      });
      list = Array.isArray(res)
        ? (res as unknown as Candidate[])
        : ((res as unknown as { data?: Candidate[] }).data ?? []);
    } catch {
      // Network failure: fall through and let the backend be the gate.
      return null;
    }

    for (const b of list) {
      const bFirst = normalize(b.first_name);
      const bMiddle = normalize(b.middle_name);
      const bLast = normalize(b.last_name);
      const firstMatch = bFirst && bFirst === firstN;
      const middleMatch = bMiddle && middleN && bMiddle === middleN;
      const lastMatch = bLast && bLast === lastN;
      const nameMatches =
        (firstMatch ? 1 : 0) + (middleMatch ? 1 : 0) + (lastMatch ? 1 : 0);

      const candidateInfo = {
        fullName:
          b.full_name ??
          `${b.first_name ?? ""} ${b.middle_name ?? ""} ${b.last_name ?? ""}`
            .trim()
            .replace(/\s+/g, " "),
        code: b.borrower_code,
        birthdate: b.birthdate,
      };

      // Tier A — exact match on all 3 name components. Treat as hard
      // duplicate regardless of other fields.
      if (nameMatches === 3) {
        return {
          ...candidateInfo,
          matchReason: "First, middle, and last name all match an existing member.",
        };
      }

      // Tier B — 2-of-3 names match AND at least 2 other identity fields
      // also line up. Covers the "misspelled middle name but same person"
      // case that was slipping through.
      if (nameMatches === 2) {
        const otherChecks: { label: string; hit: boolean }[] = [
          {
            label: "birthdate",
            hit: !!form.birthdate && b.birthdate === form.birthdate,
          },
          {
            label: "gender",
            hit: !!form.gender && normalize(b.gender) === normalize(form.gender),
          },
          {
            label: "civil status",
            hit: !!form.civil_status && normalize(b.civil_status) === normalize(form.civil_status),
          },
          {
            label: "contact number",
            hit:
              !!form.contact_number.trim() &&
              normalize(b.contact_number ?? b.phone) === normalize(form.contact_number),
          },
          {
            label: "email",
            hit: !!form.email.trim() && normalize(b.email) === normalize(form.email),
          },
          {
            label: "address",
            hit: !!form.address.trim() && normalize(b.address) === normalize(form.address),
          },
        ];
        const hits = otherChecks.filter((c) => c.hit).map((c) => c.label);
        if (hits.length >= 2) {
          return {
            ...candidateInfo,
            matchReason: `2 of 3 names and ${hits.join(", ")} match an existing member.`,
          };
        }
      }
    }

    return null;
  }

  function buildBorrowerPayload(force: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      branch_id: Number(form.branch_id),
    };

    if (form.middle_name.trim()) payload.middle_name = form.middle_name.trim();
    if (form.suffix && form.suffix !== "none") payload.suffix = form.suffix;
    if (form.birthdate) payload.birthdate = form.birthdate;
    if (form.gender) payload.gender = form.gender;
    if (form.civil_status) payload.civil_status = form.civil_status;
    if (form.contact_number.trim()) payload.contact_number = form.contact_number.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.address.trim()) {
      const street = form.address.trim();
      payload.street_address = street;
      payload.address = street;
    }
    if (form.barangay.trim()) payload.barangay = form.barangay.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    if (form.province.trim()) payload.province = form.province.trim();
    if (form.employer_or_business.trim()) payload.employer_or_business = form.employer_or_business.trim();
    if (form.monthly_income) payload.monthly_income = Number(form.monthly_income);
    payload.pledge_amount = form.pledge_amount ? Number(form.pledge_amount) : 0;

    if (form.civil_status === "married") {
      if (form.spouse_first_name.trim()) payload.spouse_first_name = form.spouse_first_name.trim();
      if (form.spouse_middle_name.trim()) payload.spouse_middle_name = form.spouse_middle_name.trim();
      if (form.spouse_last_name.trim()) payload.spouse_last_name = form.spouse_last_name.trim();
      if (form.spouse_contact_number.trim()) payload.spouse_contact_number = form.spouse_contact_number.trim();
      if (form.spouse_occupation.trim()) payload.spouse_occupation = form.spouse_occupation.trim();
    }

    if (force) payload.force = true;
    return payload;
  }

  // Parse the backend's duplicate 422 error message into structured pieces
  // so the dialog can show the match cleanly without exposing the internal
  // "Pass force=true" hint. Expected format:
  //   "A similar borrower already exists: <Full Name> (BRW-XXXXXX, born YYYY-MM-DD). Pass force=true to create anyway."
  function parseDuplicateMessage(raw: string) {
    const codeMatch = raw.match(/(BRW-[A-Z0-9]+)/i);
    const dobMatch = raw.match(/born\s+(\d{4}-\d{2}-\d{2})/i);
    const nameMatch = raw.match(/already exists:\s*([^(]+?)\s*\(/);
    return {
      code: codeMatch?.[1],
      birthdate: dobMatch?.[1],
      fullName: nameMatch?.[1]?.trim(),
    };
  }

  async function submitBorrower(force: boolean) {
    if (force) setCreatingAnyway(true);
    else setSubmitting(true);
    try {
      const created = await borrowerService.create(
        buildBorrowerPayload(force) as Parameters<typeof borrowerService.create>[0]
      );
      const borrowerId = (created as unknown as { id: number }).id;

      // Upload profile photo if provided
      if (profilePhoto && borrowerId) {
        try {
          const photoData = new FormData();
          photoData.append("photo", profilePhoto);
          await borrowerService.uploadPhoto(borrowerId, photoData);
        } catch {
          toast.error("Member created but photo upload failed");
        }
      }

      // Upload valid IDs if provided (front and back separately).
      // "Others" entries must have a custom_type_name to be uploadable —
      // otherwise the backend has no meaningful label for the document.
      const validIdsToUpload = validIds.filter(
        (v) =>
          v.type &&
          (v.front_file || v.back_file) &&
          (v.type !== "others" || v.custom_type_name.trim())
      );
      if (validIdsToUpload.length > 0 && borrowerId) {
        for (const entry of validIdsToUpload) {
          try {
            const idData = new FormData();
            idData.append("type", entry.type);
            if (entry.type === "others" && entry.custom_type_name.trim()) {
              idData.append("custom_type_name", entry.custom_type_name.trim());
            }
            if (entry.id_number.trim()) idData.append("id_number", entry.id_number.trim());
            if (entry.front_file) idData.append("front_file", entry.front_file);
            if (entry.back_file) idData.append("back_file", entry.back_file);
            await borrowerService.uploadValidId(borrowerId, idData);
          } catch {
            toast.error(`We couldn't upload the ${entry.type} ID. Please try again.`);
          }
        }
      }

      setDuplicateMatch(null);
      toast.success("Member created");
      router.push("/borrowers");
    } catch (err: unknown) {
      const apiError = err as {
        response?: {
          status?: number;
          data?: { errors?: Record<string, string[]>; message?: string };
        };
      };
      const data = apiError?.response?.data;
      const errs = data?.errors ?? {};
      const firstMessage =
        errs.first_name?.[0] ?? errs.middle_name?.[0] ?? errs.last_name?.[0] ?? data?.message;

      // Duplicate detection: surface as a dedicated dialog with a "Create
      // Anyway" button that retries with force=true. Don't dump the raw
      // "Pass force=true" line into the form errors — that's internal.
      if (!force && apiError?.response?.status === 422 && isDuplicateNameMessage(firstMessage)) {
        setDuplicateMatch({ ...parseDuplicateMessage(firstMessage!), rawMessage: firstMessage! });
        return;
      }

      notifyError(err, "We couldn't save this member. Please check the details and try again.");
    } finally {
      setSubmitting(false);
      setCreatingAnyway(false);
    }
  }

  return (
    <RouteGuard permission="borrowers:create" pageName="Add Member">
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/borrowers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add New Member</h1>
        <p className="text-sm text-muted-foreground">
          Create a new member profile
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Photo */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Profile Photo</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                {photoPreview ? (
                  <div className="relative h-24 w-24">
                    <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border">
                      <img
                        src={photoPreview}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Upload a profile photo of the member.</p>
                <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={openCamera}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Camera
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Gallery
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Camera Capture Dialog */}
        <Dialog open={cameraOpen} onOpenChange={handleCameraDialogChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Take Photo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={toggleFacingMode}
                  title="Switch camera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="h-14 w-14 rounded-full border-4 border-brand-orange bg-white hover:bg-brand-orange/10 transition-colors flex items-center justify-center"
                  title="Capture"
                >
                  <div className="h-10 w-10 rounded-full bg-brand-orange" />
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCameraDialogChange(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                  value={form.suffix || null}
                  onValueChange={(v) => update("suffix", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None">
                      {(value: string | null) =>
                        value
                          ? (SUFFIX_OPTIONS.find((o) => (o.value || "none") === value)?.label ?? value)
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
              <div className="space-y-2">
                <Label htmlFor="birthdate">
                  Birthdate <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => update("birthdate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Gender <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  className="flex gap-4 pt-2"
                  value={form.gender || null}
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
              <Label>
                Civil Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.civil_status || null}
                onValueChange={(v) => update("civil_status", v ?? "")}
              >
                <SelectTrigger className="w-full sm:w-1/2">
                  <SelectValue placeholder="Select civil status">
                    {(value: string | null) =>
                      value
                        ? (CIVIL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value)
                        : "Select civil status"
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
            </div>
          </CardContent>
        </Card>

        {/* Spouse Information (visible only when married) */}
        {form.civil_status === "married" && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-base font-semibold">Spouse Information</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="spouse_first_name">First Name</Label>
                  <Input
                    id="spouse_first_name"
                    placeholder="First name"
                    value={form.spouse_first_name ?? ""}
                    onChange={(e) => update("spouse_first_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spouse_middle_name">Middle Name</Label>
                  <Input
                    id="spouse_middle_name"
                    placeholder="Middle name"
                    value={form.spouse_middle_name ?? ""}
                    onChange={(e) => update("spouse_middle_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spouse_last_name">Last Name</Label>
                  <Input
                    id="spouse_last_name"
                    placeholder="Last name"
                    value={form.spouse_last_name ?? ""}
                    onChange={(e) => update("spouse_last_name", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="spouse_contact_number">Contact Number</Label>
                  <Input
                    id="spouse_contact_number"
                    type="tel"
                    placeholder="09XXXXXXXXX"
                    value={form.spouse_contact_number ?? ""}
                    onChange={(e) => update("spouse_contact_number", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spouse_occupation">Occupation</Label>
                  <Input
                    id="spouse_occupation"
                    placeholder="Occupation or employer"
                    value={form.spouse_occupation ?? ""}
                    onChange={(e) => update("spouse_occupation", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Contact Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_number">
                  Contact Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact_number"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={form.contact_number}
                  onChange={(e) => update("contact_number", e.target.value)}
                />
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
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">
                Street Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="address"
                placeholder="House/Lot/Block number, Street name"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="barangay">Barangay</Label>
                <Input
                  id="barangay"
                  placeholder="Barangay"
                  value={form.barangay}
                  onChange={(e) => update("barangay", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">
                  City / Municipality <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="City name"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="province">
                Province <span className="text-destructive">*</span>
              </Label>
              <Input
                id="province"
                placeholder="Province"
                value={form.province}
                onChange={(e) => update("province", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Valid IDs */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Valid IDs</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addValidId}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add ID
              </Button>
            </div>

            {validIds.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No valid IDs added. Click &quot;Add ID&quot; to attach identification documents.
              </p>
            ) : (
              <div className="space-y-4">
                {validIds.map((entry, index) => (
                  <div key={index} className="relative space-y-3 p-4 rounded-lg border bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeValidId(index)}
                      className="absolute top-2 right-2 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    {/* ID Type + ID Number (and custom name when "Others") */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                      <div className="space-y-2">
                        <Label>ID Type</Label>
                        <Select
                          value={entry.type || null}
                          onValueChange={(v) => updateValidId(index, "type", v ?? "")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select ID type">
                              {(value: string | null) =>
                                value
                                  ? (VALID_ID_OPTIONS.find((o) => o.value === value)?.label ?? value)
                                  : "Select ID type"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {VALID_ID_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>ID Number</Label>
                        <Input
                          placeholder="ID number"
                          value={entry.id_number}
                          onChange={(e) => updateValidId(index, "id_number", e.target.value)}
                        />
                      </div>
                      {entry.type === "others" && (
                        <div className="space-y-2 sm:col-span-2">
                          <Label>
                            ID Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            placeholder="e.g. Senior Citizen ID, Company ID"
                            value={entry.custom_type_name}
                            onChange={(e) =>
                              updateValidId(index, "custom_type_name", e.target.value)
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* Front / Back Uploads */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Front of ID</Label>
                        {entry.front_preview ? (
                          <div className="space-y-2">
                            <div className="relative h-44 rounded-lg overflow-hidden border bg-muted/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={entry.front_preview}
                                alt="Front ID preview"
                                className="h-full w-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  updateValidId(index, "front_file", null);
                                  updateValidId(index, "front_preview", null);
                                }}
                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs gap-1"
                              onClick={() => setCropTarget({ index, side: "front", src: entry.front_preview! })}
                            >
                              <CropIcon className="h-3.5 w-3.5" />
                              Crop
                            </Button>
                          </div>
                        ) : (
                          <label className="flex h-44 flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Upload Front</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleValidIdFile(index, "front", e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Back of ID</Label>
                        {entry.back_preview ? (
                          <div className="space-y-2">
                            <div className="relative h-44 rounded-lg overflow-hidden border bg-muted/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={entry.back_preview}
                                alt="Back ID preview"
                                className="h-full w-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  updateValidId(index, "back_file", null);
                                  updateValidId(index, "back_preview", null);
                                }}
                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs gap-1"
                              onClick={() => setCropTarget({ index, side: "back", src: entry.back_preview! })}
                            >
                              <CropIcon className="h-3.5 w-3.5" />
                              Crop
                            </Button>
                          </div>
                        ) : (
                          <label className="flex h-44 flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Upload Back</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleValidIdFile(index, "back", e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="pledge_amount">Pledge Amount (PHP)</Label>
                <Input
                  id="pledge_amount"
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0"
                  value={form.pledge_amount}
                  onChange={(e) => update("pledge_amount", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Share capital pledge. Defaults to ₱0 if left empty.</p>
              </div>
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
            disabled={submitting || checkingDuplicate}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            {checkingDuplicate ? (
              <>
                <Spinner className="size-4 mr-2" />
                Checking...
              </>
            ) : submitting ? (
              <>
                <Spinner className="size-4 mr-2" />
                Creating...
              </>
            ) : (
              "Create Member"
            )}
          </Button>
        </div>
      </form>

      {/* Profile Photo Crop Dialog — drag/zoom to position the image */}
      <PhotoCropDialog
        open={photoCropOpen}
        onOpenChange={(open) => {
          setPhotoCropOpen(open);
          if (!open) setPendingPhotoFile(null);
        }}
        imageFile={pendingPhotoFile}
        onCropComplete={handlePhotoCropComplete}
      />

      {/* ID Crop Dialog */}
      <IdCropDialog
        open={!!cropTarget}
        onOpenChange={(open) => { if (!open) setCropTarget(null); }}
        imageSrc={cropTarget?.src ?? null}
        onCropComplete={(blob, dataUrl) => {
          if (!cropTarget) return;
          const { index, side } = cropTarget;
          const croppedFile = new File([blob], `${side}-id-cropped.jpg`, { type: "image/jpeg" });
          setValidIds((prev) => prev.map((entry, i) => {
            if (i !== index) return entry;
            return side === "front"
              ? { ...entry, front_file: croppedFile, front_preview: dataUrl }
              : { ...entry, back_file: croppedFile, back_preview: dataUrl };
          }));
          setCropTarget(null);
          toast.success("ID cropped");
        }}
      />

      {/* Duplicate match confirmation — fires from either the client-side
          pre-check (Tier A: 3/3 names, or Tier B: 2/3 names + 2+ identity
          fields) or the backend's 422 response. Offers Create Anyway which
          submits with force=true to bypass both checks. */}
      <Dialog
        open={!!duplicateMatch}
        onOpenChange={(open) => { if (!open) setDuplicateMatch(null); }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Similar Member Found
            </DialogTitle>
            <DialogDescription>
              An existing member looks like this one. Review the match before
              creating a new account to avoid duplicates.
            </DialogDescription>
          </DialogHeader>
          {duplicateMatch?.matchReason && (
            <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-300/50 dark:border-amber-700/40 rounded-md px-3 py-2">
              {duplicateMatch.matchReason}
            </p>
          )}
          {/* The details box is rendered ONLY when it has something in it.
              Previously the container was unconditional while all three rows
              inside were conditional, so a match whose details did not parse
              produced an empty bordered rectangle. A partial match is still
              fine and expected — the backend emits "born unknown DOB" for a
              match with no birthdate, which the date regex correctly refuses,
              leaving name + code. */}
          {duplicateMatch &&
          (duplicateMatch.fullName || duplicateMatch.code || duplicateMatch.birthdate) ? (
            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              {duplicateMatch.fullName && (
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{duplicateMatch.fullName}</span>
                </div>
              )}
              {duplicateMatch.code && (
                <div>
                  <span className="text-muted-foreground">Member Code:</span>{" "}
                  <span className="font-mono text-brand-orange">
                    {duplicateMatch.code}
                  </span>
                </div>
              )}
              {duplicateMatch.birthdate && (
                <div>
                  <span className="text-muted-foreground">Birthdate:</span>{" "}
                  <span>{duplicateMatch.birthdate}</span>
                </div>
              )}
            </div>
          ) : duplicateMatch && duplicateFallbackText(duplicateMatch.rawMessage) ? (
            /* Nothing parsed — show what the server actually said, so the
               operator has some basis for choosing Create Anyway. */
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {duplicateFallbackText(duplicateMatch.rawMessage)}
            </div>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateMatch(null)}
              disabled={creatingAnyway}
            >
              Review Details
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={async () => {
                await submitBorrower(true);
              }}
              disabled={creatingAnyway}
            >
              {creatingAnyway ? "Creating..." : "Create Anyway"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </RouteGuard>
  );
}
