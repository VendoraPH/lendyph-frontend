"use client";

import { useEffect, useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { Camera, FileText, ImageIcon, Plus, SwitchCamera, X, Crop as CropIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoCropDialog } from "@/components/borrower/photo-crop-dialog";
import { IdCropDialog } from "@/components/borrower/id-crop-dialog";
import { VALID_ID_OPTIONS } from "@/constants";
import {
  validateUploadFile,
  IMAGE_MIME_TYPES,
  ID_MIME_TYPES,
} from "@/lib/file-validation";

export interface ValidIdEntry {
  type: string;
  custom_type_name: string;
  id_number: string;
  front_file: File | null;
  front_preview: string | null;
  back_file: File | null;
  back_preview: string | null;
  // Set once this ID has been uploaded to the server so a resubmit (after a
  // partial failure) doesn't create duplicate ID records.
  uploaded?: boolean;
}

interface Props {
  photoPreview: string | null;
  validIds: ValidIdEntry[];
  onPhotoChange: (file: File | null, preview: string | null) => void;
  onValidIdsChange: Dispatch<SetStateAction<ValidIdEntry[]>>;
  onNext: () => void;
  onBack: () => void;
}

export function StepPhotoIds({
  photoPreview,
  validIds,
  onPhotoChange,
  onValidIdsChange,
  onNext,
  onBack,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoCropOpen, setPhotoCropOpen] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cropTarget, setCropTarget] = useState<{
    index: number;
    side: "front" | "back";
    src: string;
  } | null>(null);


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
      if (videoRef.current) videoRef.current.srcObject = stream;
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

  useEffect(() => {
    if (cameraOpen) startCamera(facingMode);
    return () => {
      if (!cameraOpen) stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";
    const result = validateUploadFile(file, IMAGE_MIME_TYPES);
    if (!result.ok) {
      toast.error(result.error ?? "That photo can't be used. Please choose another image.");
      return;
    }
    setPendingPhotoFile(file);
    setPhotoCropOpen(true);
  }

  function handlePhotoCropComplete(blob: Blob) {
    const file = new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
    const reader = new FileReader();
    reader.onload = () => onPhotoChange(file, reader.result as string);
    reader.readAsDataURL(file);
    setPhotoCropOpen(false);
    setPendingPhotoFile(null);
  }

  function removePhoto() {
    onPhotoChange(null, null);
    if (photoInputRef.current) photoInputRef.current.value = "";
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

  function addValidId() {
    onValidIdsChange((prev) => [
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
    onValidIdsChange((prev) =>
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
    e.target.value = "";
    const result = validateUploadFile(file, ID_MIME_TYPES);
    if (!result.ok) {
      toast.error(result.error ?? "That file can't be used. Please choose another image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onValidIdsChange((prev) =>
        prev.map((entry, i) => {
          if (i !== index) return entry;
          return side === "front"
            ? { ...entry, front_file: file, front_preview: reader.result as string }
            : { ...entry, back_file: file, back_preview: reader.result as string };
        })
      );
    };
    reader.readAsDataURL(file);
  }

  function removeValidId(index: number) {
    onValidIdsChange((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Profile Photo</h3>
        <div className="flex items-center gap-5">
          <div className="relative">
            {photoPreview ? (
              <div className="relative h-20 w-20">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <div className="h-20 w-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Camera className="h-5 w-5 text-muted-foreground/50" />
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
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 5MB. Optional.</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCameraOpen(true)}
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
      </div>

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

      {/* Valid IDs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Valid IDs <span className="text-destructive">*</span>
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addValidId}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add ID
          </Button>
        </div>

        {validIds.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-md">
            No IDs added yet. At least one valid ID (with a front photo) is required.
          </p>
        ) : (
          <div className="space-y-3">
            {validIds.map((entry, index) => (
              <div
                key={index}
                className="relative space-y-3 p-3 rounded-lg border bg-muted/30"
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
                  <div className="space-y-1.5">
                    <Label>ID Type</Label>
                    <Select
                      value={entry.type || null}
                      onValueChange={(v) => updateValidId(index, "type", v ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select ID type">
                          {(value: string | null) =>
                            value
                              ? (VALID_ID_OPTIONS.find((o) => o.value === value)?.label ??
                                value)
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
                  <div className="space-y-1.5">
                    <Label>ID Number</Label>
                    <Input
                      placeholder="ID number"
                      value={entry.id_number}
                      onChange={(e) => updateValidId(index, "id_number", e.target.value)}
                    />
                  </div>
                  {entry.type === "others" && (
                    <div className="space-y-1.5 sm:col-span-2">
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
                  {(["front", "back"] as const).map((side) => {
                    const preview = side === "front" ? entry.front_preview : entry.back_preview;
                    return (
                      <div key={side} className="space-y-1.5">
                        <Label className="capitalize">{side} of ID</Label>
                        {preview ? (
                          <div className="space-y-1.5">
                            <div className="relative h-36 rounded-lg overflow-hidden border bg-muted/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={preview}
                                alt={`${side} ID preview`}
                                className="h-full w-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  updateValidId(
                                    index,
                                    side === "front" ? "front_file" : "back_file",
                                    null
                                  );
                                  updateValidId(
                                    index,
                                    side === "front" ? "front_preview" : "back_preview",
                                    null
                                  );
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
                                setCropTarget({ index, side, src: preview })
                              }
                            >
                              <CropIcon className="h-3.5 w-3.5" />
                              Crop
                            </Button>
                          </div>
                        ) : (
                          <label className="flex h-36 flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground capitalize">
                              Upload {side}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,application/pdf"
                              onChange={(e) => handleValidIdFile(index, side, e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          Continue →
        </Button>
      </div>

      <PhotoCropDialog
        open={photoCropOpen}
        onOpenChange={(open) => {
          setPhotoCropOpen(open);
          if (!open) setPendingPhotoFile(null);
        }}
        imageFile={pendingPhotoFile}
        onCropComplete={handlePhotoCropComplete}
      />

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
          onValidIdsChange((prev) =>
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
  );
}
