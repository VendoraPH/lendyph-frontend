"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { borrowerService } from "@/services";
import type { Borrower } from "@/types";
import { PhotoCropDialog } from "@/components/borrower/photo-crop-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusBadgeColor: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
  blacklisted: "bg-gray-900 text-white border-gray-700",
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface BorrowerHeaderProps {
  borrower: Borrower;
  onEdit: () => void;
  onPhotoUpdate?: () => void;
}

export function BorrowerHeader({ borrower, onEdit, onPhotoUpdate }: BorrowerHeaderProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemovePhoto() {
    setRemoving(true);
    try {
      await borrowerService.deletePhoto(borrower.id);
      toast.success("Photo removed");
      setRemoveConfirmOpen(false);
      onPhotoUpdate?.();
    } catch {
      toast.error("Failed to remove photo");
    } finally {
      setRemoving(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setCropDialogOpen(true);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleCroppedPhoto(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append("photo", blob, "profile.jpg");
      await borrowerService.uploadPhoto(borrower.id, formData);
      toast.success("Photo updated");
      onPhotoUpdate?.();
    } catch {
      toast.error("Failed to upload photo");
    }
    setCropDialogOpen(false);
    setSelectedFile(null);
  }
  const details = [
    borrower.gender ? (borrower.gender === "male" ? "Male" : "Female") : null,
    borrower.civil_status ? borrower.civil_status.charAt(0).toUpperCase() + borrower.civil_status.slice(1) : null,
    borrower.birthdate
      ? `${new Date().getFullYear() - new Date(borrower.birthdate).getFullYear()} yrs old`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <Link
        href="/borrowers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Borrowers
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
              <Avatar size="lg">
                {borrower.photo ? (
                  <AvatarImage src={borrower.photo} alt={borrower.full_name} />
                ) : null}
                <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xl font-semibold">
                  {getInitials(borrower.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <input
                ref={photoInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>
            {borrower.photo ? (
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setRemoveConfirmOpen(true)}
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {borrower.full_name}
              </h1>
              <Badge
                variant="outline"
                className={statusBadgeColor[borrower.status]}
              >
                {borrower.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {borrower.borrower_code}
            </p>
            <p className="text-sm text-muted-foreground">{details}</p>
            <p className="text-sm text-muted-foreground">
              {borrower.contact_number || borrower.phone}
              {borrower.email ? ` · ${borrower.email}` : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={onEdit}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <PhotoCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageFile={selectedFile}
        onCropComplete={handleCroppedPhoto}
      />

      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove profile photo?</DialogTitle>
            <DialogDescription>
              This will delete {borrower.full_name}&apos;s current photo. You can upload a new one anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirmOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemovePhoto} disabled={removing}>
              {removing ? "Removing..." : "Remove Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
