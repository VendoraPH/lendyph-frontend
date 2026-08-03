"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RouteGuard } from "@/components/common";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  FileText,
  ImageIcon,
  Plus,
  X,
  SwitchCamera,
  Crop as CropIcon,
} from "lucide-react";
import { toast } from "sonner";
import { notifyError, notifyValidation } from "@/lib/notify";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

import { api } from "@/lib/api-client";
import { borrowerService } from "@/services/borrower.service";
import { branchService, type ApiBranch } from "@/services/branch.service";
import { IdCropDialog } from "@/components/borrower/id-crop-dialog";
import { PhotoCropDialog } from "@/components/borrower/photo-crop-dialog";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS, VALID_ID_OPTIONS } from "@/constants";
import type { Borrower } from "@/types";

interface ValidIdEntry {
  type: string;
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
    branch_id: "",
    spouse_first_name: "",
    spouse_middle_name: "",
    spouse_last_name: "",
    spouse_contact_number: "",
    spouse_occupation: "",
  };
}

function borrowerToFormData(b: Borrower): BorrowerFormData {
  const raw = b as unknown as Record<string, unknown>;
  const pick = (k: string) => {
    const v = raw[k];
    return typeof v === "string" ? v : v != null ? String(v) : "";
  };
  return {
    first_name: b.first_name ?? "",
    middle_name: b.middle_name ?? "",
    last_name: b.last_name ?? "",
    suffix: b.suffix ?? "",
    birthdate: b.birthdate ?? "",
    gender: b.gender ?? "",
    civil_status: b.civil_status ?? "",
    contact_number: b.contact_number ?? b.phone ?? "",
    email: b.email ?? "",
    address: b.address ?? "",
    barangay: pick("barangay"),
    city: pick("city"),
    province: pick("province"),
    employer_or_business: b.employer_or_business ?? "",
    monthly_income:
      b.monthly_income != null ? String(b.monthly_income) : "",
    branch_id: b.branch?.id != null ? String(b.branch.id) : "",
    spouse_first_name: pick("spouse_first_name"),
    spouse_middle_name: pick("spouse_middle_name"),
    spouse_last_name: pick("spouse_last_name"),
    spouse_contact_number: pick("spouse_contact_number"),
    spouse_occupation: pick("spouse_occupation"),
  };
}

export default function EditBorrowerPage() {
  const router = useRouter();
  const params = useParams();
  const borrowerId = Number(params.id);

  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [form, setForm] = useState<BorrowerFormData>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Branches for selector
  const [branches, setBranches] = useState<ApiBranch[]>([]);

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Photo crop dialog
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
  const [cropTarget, setCropTarget] = useState<{
    index: number;
    side: "front" | "back";
    src: string;
  } | null>(null);

  // Load borrower + branches on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [b, branchRes] = await Promise.all([
          borrowerService.detail(borrowerId),
          branchService.list().catch(() => [] as ApiBranch[]),
        ]);
        if (cancelled) return;
        setBorrower(b);
        setForm(borrowerToFormData(b));
        if (b.photo_url) setPhotoPreview(b.photo_url);
        const list = Array.isArray(branchRes)
          ? branchRes
          : ((branchRes as unknown as { data?: ApiBranch[] }).data ?? []);
        setBranches(list.filter((br) => br.is_active));
      } catch {
        if (!cancelled) toast.error("We couldn't load the member details. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [borrowerId]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPhotoFile(file);
    setPhotoCropOpen(true);
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

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
        setCameraOpen(false);
        stopCamera();
        setPendingPhotoFile(file);
        setPhotoCropOpen(true);
      },
      "image/jpeg",
      0.9
    );
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

  useEffect(() => {
    if (cameraOpen) {
      startCamera(facingMode);
    }
    return () => {
      if (!cameraOpen) stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  function addValidId() {
    setValidIds((prev) => [
      ...prev,
      {
        type: "",
        custom_type_name: "",
        id_number: "",
        front_file: null,
        front_preview: null,
        back_file: null,
        back_preview: null,
      },
    ]);
  }

  function updateValidId(index: number, field: keyof ValidIdEntry, value: unknown) {
    setValidIds((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  }

  function handleValidIdFile(
    index: number,
    side: "front" | "back",
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setValidIds((prev) =>
        prev.map((entry, i) =>
          i === index
            ? side === "front"
              ? { ...entry, front_file: file, front_preview: reader.result as string }
              : { ...entry, back_file: file, back_preview: reader.result as string }
            : entry
        )
      );
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

    // A missing branch means the member isn't assigned to one — a
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
    if (!form.middle_name.trim()) missing.push("Middle name");
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

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        middle_name: form.middle_name.trim() || null,
        suffix: form.suffix && form.suffix !== "none" ? form.suffix : null,
        birthdate: form.birthdate || null,
        gender: form.gender || null,
        civil_status: form.civil_status || null,
        contact_number: form.contact_number.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        barangay: form.barangay.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        employer_or_business: form.employer_or_business.trim() || null,
        monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
        branch_id: Number(form.branch_id),
      };

      if (form.civil_status === "married") {
        payload.spouse_first_name = form.spouse_first_name.trim() || null;
        payload.spouse_middle_name = form.spouse_middle_name.trim() || null;
        payload.spouse_last_name = form.spouse_last_name.trim() || null;
        payload.spouse_contact_number = form.spouse_contact_number.trim() || null;
        payload.spouse_occupation = form.spouse_occupation.trim() || null;
      }

      await borrowerService.update(borrowerId, payload as Partial<Borrower>);

      if (profilePhoto) {
        try {
          const photoData = new FormData();
          photoData.append("photo", profilePhoto);
          await borrowerService.uploadPhoto(borrowerId, photoData);
        } catch {
          toast.error("Member updated but photo upload failed");
        }
      }

      const validIdsToUpload = validIds.filter(
        (v) =>
          v.type &&
          (v.front_file || v.back_file) &&
          (v.type !== "others" || v.custom_type_name.trim())
      );
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
          await api.upload(`/borrowers/${borrowerId}/valid-ids`, idData);
        } catch {
          toast.error(`We couldn't upload the ${entry.type} ID. Please try again.`);
        }
      }

      toast.success("Member updated");
      router.push(`/borrowers/${borrowerId}`);
    } catch (err: unknown) {
      notifyError(err, "We couldn't save your changes. Please check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!borrower) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-muted-foreground">Member not found.</p>
      </div>
    );
  }

  return (
    <RouteGuard permission="borrowers:update" pageName="Edit Member">
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div>
          <Link
            href={`/borrowers/${borrowerId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Member
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Edit Member</h1>
          <p className="text-sm text-muted-foreground">
            Update profile for {borrower.full_name} —{" "}
            <span className="font-mono text-brand-orange">{borrower.borrower_code}</span>
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
                    <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-border">
                      <img
                        src={photoPreview}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute top-0 right-0 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90"
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
                  <p className="text-sm text-muted-foreground">
                    Upload a profile photo of the member.
                  </p>
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

          {/* Branch Assignment */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-base font-semibold">Branch Assignment</h2>
              <p className="text-sm text-muted-foreground">
                Currently assigned to:{" "}
                <span className="font-medium text-foreground">
                  {borrower.branch?.name ?? "Not assigned"}
                  {borrower.branch?.code ? ` (${borrower.branch.code})` : ""}
                </span>
              </p>
              <div className="space-y-2">
                <Label>
                  Assigned Branch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.branch_id || null}
                  onValueChange={(v) => update("branch_id", v ?? "")}
                >
                  <SelectTrigger className="w-full sm:w-2/3">
                    <SelectValue placeholder="Select branch">
                      {(value: string | null) => {
                        if (!value) return "Select branch";
                        const match = branches.find((b) => String(b.id) === value);
                        if (match) return `${match.name}${match.code ? ` (${match.code})` : ""}`;
                        return borrower?.branch?.name ?? value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.length === 0 && borrower?.branch ? (
                      <SelectItem value={String(borrower.branch.id)}>
                        {borrower.branch.name}
                      </SelectItem>
                    ) : (
                      branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                          {b.code ? ` (${b.code})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Change the branch this member is assigned to.
                </p>
              </div>
            </CardContent>
          </Card>

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
                  <Label htmlFor="middle_name">
                    Middle Name <span className="text-destructive">*</span>
                  </Label>
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
                <h2 className="text-base font-semibold">Add Valid IDs</h2>
                <Button type="button" variant="outline" size="sm" onClick={addValidId}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add ID
                </Button>
              </div>

              {validIds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Attach additional valid IDs. Existing IDs are managed from the member detail
                  page.
                </p>
              ) : (
                <div className="space-y-4">
                  {validIds.map((entry, index) => (
                    <div
                      key={index}
                      className="relative space-y-3 p-4 rounded-lg border bg-muted/30"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeValidId(index)}
                        className="absolute top-2 right-2 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>

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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Front of ID</Label>
                          {entry.front_preview ? (
                            <div className="space-y-2">
                              <div className="relative h-44 rounded-lg overflow-hidden border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={entry.front_preview}
                                  alt="Front ID preview"
                                  className="h-full w-full object-cover"
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
                                onClick={() =>
                                  setCropTarget({
                                    index,
                                    side: "front",
                                    src: entry.front_preview!,
                                  })
                                }
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
                              <div className="relative h-44 rounded-lg overflow-hidden border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={entry.back_preview}
                                  alt="Back ID preview"
                                  className="h-full w-full object-cover"
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
                                onClick={() =>
                                  setCropTarget({
                                    index,
                                    side: "back",
                                    src: entry.back_preview!,
                                  })
                                }
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
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3 pb-8">
            <Link
              href={`/borrowers/${borrowerId}`}
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
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>

        {/* Profile Photo Crop Dialog */}
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
          onOpenChange={(open) => {
            if (!open) setCropTarget(null);
          }}
          imageSrc={cropTarget?.src ?? null}
          onCropComplete={(blob, dataUrl) => {
            if (!cropTarget) return;
            const { index, side } = cropTarget;
            const croppedFile = new File([blob], `${side}-id-cropped.jpg`, {
              type: "image/jpeg",
            });
            setValidIds((prev) =>
              prev.map((entry, i) => {
                if (i !== index) return entry;
                return side === "front"
                  ? { ...entry, front_file: croppedFile, front_preview: dataUrl }
                  : { ...entry, back_file: croppedFile, back_preview: dataUrl };
              })
            );
            setCropTarget(null);
            toast.success("ID cropped");
          }}
        />
      </div>
    </RouteGuard>
  );
}
