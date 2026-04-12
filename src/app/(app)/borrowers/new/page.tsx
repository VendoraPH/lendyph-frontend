"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RouteGuard } from "@/components/common";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, ChevronsUpDown, FileText, ImageIcon, Plus, X, SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

import { api } from "@/lib/api-client";
import { borrowerService } from "@/services/borrower.service";
import { IdCropDialog } from "./_components/id-crop-dialog";
import { Crop as CropIcon } from "lucide-react";
import { branchService, type ApiBranch } from "@/services/branch.service";
import { CIVIL_STATUS_OPTIONS, SUFFIX_OPTIONS, VALID_ID_OPTIONS } from "@/constants";

interface ValidIdEntry {
  type: string;
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
  const [form, setForm] = useState<BorrowerFormData>(emptyForm());
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [branchOpen, setBranchOpen] = useState(false);
  const [selectedBranchName, setSelectedBranchName] = useState("");

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Camera capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Valid IDs
  const [validIds, setValidIds] = useState<ValidIdEntry[]>([]);
  const [cropTarget, setCropTarget] = useState<{ index: number; side: "front" | "back"; src: string } | null>(null);

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

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
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
      setProfilePhoto(file);
      setPhotoPreview(canvas.toDataURL("image/jpeg", 0.9));
      setCameraOpen(false);
      stopCamera();
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
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // Check for potential duplicate borrower by comparing first/middle/last names
  async function checkDuplicate(): Promise<{ isDuplicate: boolean; match?: string }> {
    try {
      const searchQuery = `${form.first_name.trim()} ${form.last_name.trim()}`;
      const res = await borrowerService.list({ search: searchQuery, per_page: 20 });
      const borrowers = Array.isArray(res)
        ? res
        : ((res as unknown as { data?: Array<Record<string, unknown>> }).data ?? []);

      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
      const firstN = normalize(form.first_name);
      const middleN = normalize(form.middle_name);
      const lastN = normalize(form.last_name);

      for (const b of borrowers as Array<Record<string, unknown>>) {
        const bFirst = normalize(String(b.first_name ?? ""));
        const bMiddle = normalize(String(b.middle_name ?? ""));
        const bLast = normalize(String(b.last_name ?? ""));

        // Exact match on all three
        if (bFirst === firstN && bMiddle === middleN && bLast === lastN) {
          return { isDuplicate: true, match: String(b.full_name ?? `${b.first_name} ${b.last_name}`) };
        }
        // Fuzzy: same last name + same first name (even if middle differs slightly)
        if (bFirst === firstN && bLast === lastN) {
          return { isDuplicate: true, match: String(b.full_name ?? `${b.first_name} ${b.last_name}`) };
        }
      }
      return { isDuplicate: false };
    } catch {
      // If the duplicate check fails, allow the user to proceed — don't block on network errors
      return { isDuplicate: false };
    }
  }

  const [duplicateConfirm, setDuplicateConfirm] = useState<string | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const clientErrors: Record<string, string[]> = {};
    if (!form.first_name.trim()) clientErrors.first_name = ["First name is required"];
    if (!form.last_name.trim()) clientErrors.last_name = ["Last name is required"];
    if (!form.middle_name.trim()) clientErrors.middle_name = ["Middle name is required"];
    if (!form.birthdate) clientErrors.birthdate = ["Birthdate is required"];
    if (!form.gender) clientErrors.gender = ["Gender is required"];
    if (!form.civil_status) clientErrors.civil_status = ["Civil status is required"];
    if (!form.contact_number.trim()) clientErrors.contact_number = ["Contact number is required"];
    if (!form.address.trim()) clientErrors.address = ["Street address is required"];
    if (!form.city.trim()) clientErrors.city = ["City / Municipality is required"];
    if (!form.province.trim()) clientErrors.province = ["Province is required"];
    if (!form.branch_id) clientErrors.branch_id = ["Branch is required"];

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error("Please fill in all required fields");
      return;
    }

    // Duplicate check (skip if user already confirmed to proceed)
    if (!forceSubmit) {
      const dup = await checkDuplicate();
      if (dup.isDuplicate && dup.match) {
        setDuplicateConfirm(dup.match);
        return;
      }
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
      if (form.barangay.trim()) payload.barangay = form.barangay.trim();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.province.trim()) payload.province = form.province.trim();
      if (form.employer_or_business.trim()) payload.employer_or_business = form.employer_or_business.trim();
      if (form.monthly_income) payload.monthly_income = Number(form.monthly_income);
      payload.pledge_amount = form.pledge_amount ? Number(form.pledge_amount) : 0;

      // Spouse info (only when married)
      if (form.civil_status === "married") {
        if (form.spouse_first_name.trim()) payload.spouse_first_name = form.spouse_first_name.trim();
        if (form.spouse_middle_name.trim()) payload.spouse_middle_name = form.spouse_middle_name.trim();
        if (form.spouse_last_name.trim()) payload.spouse_last_name = form.spouse_last_name.trim();
        if (form.spouse_contact_number.trim()) payload.spouse_contact_number = form.spouse_contact_number.trim();
        if (form.spouse_occupation.trim()) payload.spouse_occupation = form.spouse_occupation.trim();
      }

      const created = await borrowerService.create(payload as Parameters<typeof borrowerService.create>[0]);
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

      // Upload valid IDs if provided (front and back separately)
      const validIdsToUpload = validIds.filter((v) => v.type && (v.front_file || v.back_file));
      if (validIdsToUpload.length > 0 && borrowerId) {
        for (const entry of validIdsToUpload) {
          try {
            const idData = new FormData();
            idData.append("type", entry.type);
            if (entry.id_number.trim()) idData.append("id_number", entry.id_number.trim());
            if (entry.front_file) idData.append("front_file", entry.front_file);
            if (entry.back_file) idData.append("back_file", entry.back_file);
            await api.upload(`/borrowers/${borrowerId}/valid-ids`, idData);
          } catch {
            toast.error(`Failed to upload ${entry.type} ID`);
          }
        }
      }

      toast.success("Member created successfully");
      router.push("/borrowers");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (apiError?.response?.data?.errors) {
        setErrors(apiError.response.data.errors);
        toast.error("Please fix the validation errors below");
      } else if (apiError?.response?.data?.message) {
        toast.error(apiError.response.data.message);
      } else {
        toast.error("Failed to create member");
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
                <Label htmlFor="middle_name">
                  Middle Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="middle_name"
                  placeholder="Dela Cruz"
                  value={form.middle_name}
                  onChange={(e) => update("middle_name", e.target.value)}
                />
                {fieldError("middle_name")}
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
                {fieldError("birthdate")}
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
                {fieldError("gender")}
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
              <Label htmlFor="address">
                Street Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="address"
                placeholder="House/Lot/Block number, Street name"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
              {fieldError("address")}
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
                {fieldError("city")}
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
              {fieldError("province")}
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

                    {/* ID Type + ID Number */}
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
                    </div>

                    {/* Front / Back Uploads */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Front of ID</Label>
                        {entry.front_preview ? (
                          <div className="space-y-2">
                            <div className="relative h-28 rounded-lg overflow-hidden border">
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
                              onClick={() => setCropTarget({ index, side: "front", src: entry.front_preview! })}
                            >
                              <CropIcon className="h-3.5 w-3.5" />
                              Crop
                            </Button>
                          </div>
                        ) : (
                          <label className="flex h-28 flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
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
                            <div className="relative h-28 rounded-lg overflow-hidden border">
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
                              onClick={() => setCropTarget({ index, side: "back", src: entry.back_preview! })}
                            >
                              <CropIcon className="h-3.5 w-3.5" />
                              Crop
                            </Button>
                          </div>
                        ) : (
                          <label className="flex h-28 flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
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
                {fieldError("monthly_income")}
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
                {fieldError("pledge_amount")}
              </div>
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
                <Popover open={branchOpen} onOpenChange={setBranchOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={branchOpen}
                        className="flex h-8 w-full sm:w-1/2 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      />
                    }
                  >
                    <span className={cn("truncate", !form.branch_id && "text-muted-foreground")}>
                      {form.branch_id && selectedBranchName
                        ? selectedBranchName
                        : "Select a branch"}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-(--anchor-width) p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search branch..." />
                      <CommandList>
                        <CommandEmpty>No branch found.</CommandEmpty>
                        <CommandGroup>
                          {branches.map((branch) => (
                            <CommandItem
                              key={branch.id}
                              value={branch.name}
                              onSelect={() => {
                                update("branch_id", String(branch.id));
                                setSelectedBranchName(branch.name);
                                setBranchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 size-4",
                                  form.branch_id === String(branch.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {branch.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
              "Create Member"
            )}
          </Button>
        </div>
      </form>

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

      {/* Duplicate Account Warning Dialog */}
      <Dialog open={!!duplicateConfirm} onOpenChange={(open) => { if (!open) setDuplicateConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-amber-500" />
              Possible Duplicate Account
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              An existing member with a matching name was found:
            </p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {duplicateConfirm}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to create a new member? This may create a duplicate.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDuplicateConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setDuplicateConfirm(null);
                setForceSubmit(true);
                // Re-trigger submit after state update
                setTimeout(() => {
                  const formEl = document.querySelector("form");
                  if (formEl) formEl.requestSubmit();
                }, 0);
              }}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              Create Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </RouteGuard>
  );
}
