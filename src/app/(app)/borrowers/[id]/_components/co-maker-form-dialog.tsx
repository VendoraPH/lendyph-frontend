"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { RELATIONSHIP_OPTIONS, VALID_ID_OPTIONS } from "@/constants";
import type { CoMaker, CoMakerRelationship, Loan, ValidIdType } from "@/types";
import { coMakerService, type CreateCoMakerData } from "@/services/co-maker.service";
import { formatCurrency } from "@/lib/format";

interface CoMakerFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  relationship: CoMakerRelationship | "";
  phone: string;
  address: string;
  occupation: string;
  employer: string;
  monthly_income: string;
  valid_id_type: ValidIdType | "";
  valid_id_number: string;
  valid_id_photo: string | undefined;
  photo: string | undefined;
  loan_id: number | "";
}

function emptyForm(): CoMakerFormData {
  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    relationship: "",
    phone: "",
    address: "",
    occupation: "",
    employer: "",
    monthly_income: "",
    valid_id_type: "",
    valid_id_number: "",
    valid_id_photo: undefined,
    photo: undefined,
    loan_id: "",
  };
}

function coMakerToForm(cm: CoMaker): CoMakerFormData {
  // Parse full_name back into parts if individual fields aren't available
  const raw = cm as unknown as Record<string, unknown>;
  const parts = (cm.full_name ?? "").split(" ");
  return {
    first_name: (raw.first_name as string) ?? parts[0] ?? "",
    middle_name: (raw.middle_name as string) ?? (parts.length > 2 ? parts.slice(1, -1).join(" ") : ""),
    last_name: (raw.last_name as string) ?? (parts.length > 1 ? parts[parts.length - 1]! : ""),
    suffix: (raw.suffix as string) ?? "",
    relationship: ((raw.relationship_to_borrower as string) ?? cm.relationship ?? "") as CoMakerRelationship | "",
    phone: (raw.contact_number as string) ?? cm.phone ?? "",
    address: cm.address ?? "",
    occupation: cm.occupation ?? "",
    employer: cm.employer ?? "",
    monthly_income: cm.monthly_income?.toString() ?? "",
    valid_id_type: cm.valid_id_type ?? "",
    valid_id_number: cm.valid_id_number ?? "",
    valid_id_photo: cm.valid_id_photo,
    photo: cm.photo,
    loan_id: cm.loan_id ?? "",
  };
}

function generateCoMakerCode(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `CM-${year}${seq}`;
}

// ── Add Co-Maker Dialog ──

interface AddCoMakerDialogProps {
  loans: Loan[];
  borrowerId: number;
  coMakerCount: number;
  existingCoMakers: CoMaker[];
  onAdd: (data: CreateCoMakerData) => void;
}

export function AddCoMakerDialog({
  loans,
  borrowerId,
  coMakerCount,
  existingCoMakers,
  onAdd,
}: AddCoMakerDialogProps) {
  const [form, setForm] = useState<CoMakerFormData>(emptyForm());
  const [open, setOpen] = useState(false);
  const idPhotoRef = useRef<HTMLInputElement>(null);
  const [idPhotoName, setIdPhotoName] = useState("");

  const selectedLoanHasCoMaker = form.loan_id
    ? existingCoMakers.some((cm) => cm.loan_id === form.loan_id)
    : false;

  const update = (field: keyof CoMakerFormData, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm(emptyForm());
    setIdPhotoName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.relationship || !form.phone.trim()) return;

    const payload: CreateCoMakerData = {
      first_name: form.first_name,
      last_name: form.last_name,
      ...(form.middle_name && { middle_name: form.middle_name }),
      ...(form.suffix && { suffix: form.suffix }),
      relationship_to_borrower: form.relationship,
      contact_number: form.phone,
      ...(form.address && { address: form.address }),
      ...(form.occupation && { occupation: form.occupation }),
      ...(form.employer && { employer: form.employer }),
      ...(form.monthly_income && { monthly_income: Number(form.monthly_income) }),
    };
    onAdd(payload);
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-brand-orange-foreground hover:bg-brand-orange-dark transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Add Co-Maker
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add Co-Maker</DialogTitle>
          <DialogDescription>
            Register a co-maker linked to a loan for this borrower.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <CoMakerFormFields
            form={form}
            update={update}
            loans={loans}
            idPhotoRef={idPhotoRef}
            idPhotoName={idPhotoName}
            setIdPhotoName={setIdPhotoName}
            loanWarning={selectedLoanHasCoMaker ? "This loan already has a co-maker assigned." : undefined}
          />
          <div className="flex justify-end gap-3 pt-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              Add Co-Maker
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Co-Maker Dialog ──

interface EditCoMakerDialogProps {
  coMaker: CoMaker;
  loans: Loan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: CoMaker) => void;
}

export function EditCoMakerDialog({
  coMaker,
  loans,
  open,
  onOpenChange,
  onSave,
}: EditCoMakerDialogProps) {
  // Start from the list snapshot so the form is usable immediately; a fresh
  // copy from the detail endpoint replaces it as soon as it arrives. This
  // catches any fields another user (or an admin) edited since the list
  // was last fetched.
  const [fresh, setFresh] = useState<CoMaker>(coMaker);
  const [form, setForm] = useState<CoMakerFormData>(coMakerToForm(coMaker));
  const [refreshing, setRefreshing] = useState(false);
  const idPhotoRef = useRef<HTMLInputElement>(null);
  const [idPhotoName, setIdPhotoName] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRefreshing(true);
    coMakerService
      .detail(coMaker.id)
      .then((data) => {
        if (cancelled) return;
        setFresh(data);
        setForm(coMakerToForm(data));
      })
      .catch(() => {
        // Fall back to the list snapshot silently — the form is already
        // populated from it, so the user can still edit.
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, coMaker.id]);

  const update = (field: keyof CoMakerFormData, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.relationship || !form.phone.trim()) return;

    onSave({
      ...fresh,
      full_name: [form.first_name, form.middle_name, form.last_name, form.suffix].filter(Boolean).join(" "),
      relationship: form.relationship as CoMakerRelationship,
      phone: form.phone,
      address: form.address || undefined,
      occupation: form.occupation || undefined,
      employer: form.employer || undefined,
      monthly_income: form.monthly_income ? Number(form.monthly_income) : undefined,
      valid_id_type: (form.valid_id_type || undefined) as ValidIdType | undefined,
      valid_id_number: form.valid_id_number || undefined,
      valid_id_photo: form.valid_id_photo,
      photo: form.photo,
      loan_id: form.loan_id as number,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Co-Maker
            {refreshing && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                aria-label="Refreshing latest data"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            Update co-maker profile for {fresh.full_name ?? coMaker.full_name} —{" "}
            <span className="font-mono text-brand-orange">
              {fresh.co_maker_code ?? coMaker.co_maker_code}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <CoMakerFormFields
            form={form}
            update={update}
            loans={loans}
            idPhotoRef={idPhotoRef}
            idPhotoName={idPhotoName}
            setIdPhotoName={setIdPhotoName}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared Form Fields ──

function CoMakerFormFields({
  form,
  update,
  loans,
  idPhotoRef,
  idPhotoName,
  setIdPhotoName,
  loanWarning,
}: {
  form: CoMakerFormData;
  update: (field: keyof CoMakerFormData, value: string | number | undefined) => void;
  loans: Loan[];
  idPhotoRef: React.RefObject<HTMLInputElement | null>;
  idPhotoName: string;
  setIdPhotoName: (name: string) => void;
  loanWarning?: string;
}) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Loan Selection */}
      <div className="space-y-2">
        <Label>Linked Loan *</Label>
        <Select
          value={form.loan_id ? String(form.loan_id) : undefined}
          onValueChange={(v) => update("loan_id", Number(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a loan" />
          </SelectTrigger>
          <SelectContent>
            {loans.map((loan) => (
              <SelectItem key={loan.id} value={String(loan.id)}>
                {loan.purpose ?? `Loan #${loan.id}`} — {formatCurrency(loan.principal_amount)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loanWarning && (
          <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {loanWarning}
          </p>
        )}
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="cm_first_name">First Name *</Label>
          <Input
            id="cm_first_name"
            placeholder="Juan"
            value={form.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_middle_name">Middle Name</Label>
          <Input
            id="cm_middle_name"
            placeholder="Santos"
            value={form.middle_name}
            onChange={(e) => update("middle_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_last_name">Last Name *</Label>
          <Input
            id="cm_last_name"
            placeholder="Dela Cruz"
            value={form.last_name}
            onChange={(e) => update("last_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_suffix">Suffix</Label>
          <Input
            id="cm_suffix"
            placeholder="Jr., Sr., III"
            value={form.suffix}
            onChange={(e) => update("suffix", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Relationship to Member *</Label>
          <Select
            value={form.relationship || null}
            onValueChange={(v) => update("relationship", v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_phone">Contact Number *</Label>
          <Input
            id="cm_phone"
            type="tel"
            placeholder="09XXXXXXXXX"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_occupation">Occupation</Label>
          <Input
            id="cm_occupation"
            placeholder="e.g. Teacher, Engineer"
            value={form.occupation}
            onChange={(e) => update("occupation", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cm_address">Address</Label>
        <Textarea
          id="cm_address"
          placeholder="Full address"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
        />
      </div>

      {/* Employment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_employer">Employer / Business</Label>
          <Input
            id="cm_employer"
            placeholder="Company or business name"
            value={form.employer}
            onChange={(e) => update("employer", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_income">Monthly Income (PHP)</Label>
          <Input
            id="cm_income"
            type="number"
            min={0}
            step={100}
            placeholder="0"
            value={form.monthly_income}
            onChange={(e) => update("monthly_income", e.target.value)}
          />
        </div>
      </div>

      {/* ID & Documents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valid ID Type</Label>
          <Select
            value={form.valid_id_type || null}
            onValueChange={(v) => update("valid_id_type", v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select ID type" />
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
          <Label htmlFor="cm_id_number">Valid ID Number</Label>
          <Input
            id="cm_id_number"
            placeholder="ID number"
            value={form.valid_id_number}
            onChange={(e) => update("valid_id_number", e.target.value)}
          />
        </div>
      </div>

      {/* ID Photo Upload */}
      <div className="space-y-2">
        <Label>Valid ID Photo</Label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-brand-orange/40"
          onClick={() => idPhotoRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {idPhotoName || "Click to upload ID photo"}
          </p>
          <p className="text-xs text-muted-foreground">JPG, PNG or PDF up to 5MB</p>
          <input
            ref={idPhotoRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setIdPhotoName(file.name);
                update("valid_id_photo", URL.createObjectURL(file));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
