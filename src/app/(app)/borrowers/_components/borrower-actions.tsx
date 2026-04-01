"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UserPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  AlertTriangle,
  CalendarIcon,
  Upload,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  VALID_ID_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  SUFFIX_OPTIONS,
  PHILIPPINE_PROVINCES,
} from "@/constants";
import type {
  Borrower,
  CivilStatus,
  Gender,
  ValidIdType,
  EmploymentType,
} from "@/types";
import { formatDate, generateBorrowerCode, buildFullName } from "./utils";

// ── Types ──

export interface BorrowerForm {
  borrower_code: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  birthdate: string;
  civil_status: CivilStatus | "";
  gender: Gender | "";
  email: string;
  phone: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  zip_code: string;
  employer_or_business: string;
  employment_type: EmploymentType | "";
  monthly_income: string;
  valid_id_type: ValidIdType | "";
  valid_id_number: string;
  photo: string | undefined;
  valid_id_photo: string | undefined;
}

// ── Helpers ──

export function emptyForm(code: string): BorrowerForm {
  return {
    borrower_code: code,
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    birthdate: "",
    civil_status: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    barangay: "",
    city: "",
    province: "",
    zip_code: "",
    employer_or_business: "",
    employment_type: "",
    monthly_income: "",
    valid_id_type: "",
    valid_id_number: "",
    photo: undefined,
    valid_id_photo: undefined,
  };
}

export function borrowerToForm(b: Borrower): BorrowerForm {
  return {
    borrower_code: b.borrower_code,
    first_name: b.first_name,
    middle_name: b.middle_name ?? "",
    last_name: b.last_name,
    suffix: b.suffix ?? "",
    birthdate: b.birthdate ?? "",
    civil_status: (b.civil_status as BorrowerForm["civil_status"]) ?? "",
    gender: (b.gender as BorrowerForm["gender"]) ?? "",
    email: b.email ?? "",
    phone: b.contact_number ?? b.phone ?? "",
    address: b.address ?? "",
    barangay: "",
    city: "",
    province: "",
    zip_code: "",
    employer_or_business: b.employer_or_business ?? "",
    employment_type: "",
    monthly_income: b.monthly_income?.toString() ?? "",
    valid_id_type: "",
    valid_id_number: "",
    photo: b.photo_url ?? b.photo,
    valid_id_photo: undefined,
  };
}

// ── Borrower Form Tabs ──

export function BorrowerFormTabs({
  form,
  update,
}: {
  form: BorrowerForm;
  update: (field: keyof BorrowerForm, value: string | undefined) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const idPhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(
    form.photo
  );
  const [idPhotoName, setIdPhotoName] = useState<string>("");

  return (
    <Tabs defaultValue="personal">
      <TabsList variant="line" className="w-full">
        <TabsTrigger value="personal">Personal Info</TabsTrigger>
        <TabsTrigger value="contact">Contact & Address</TabsTrigger>
        <TabsTrigger value="employment">Employment & Income</TabsTrigger>
        <TabsTrigger value="documents">ID & Documents</TabsTrigger>
      </TabsList>

      {/* Tab 1: Personal Info */}
      <TabsContent value="personal" className="space-y-4 pt-4">
        {/* Photo upload */}
        <div className="flex items-center gap-4">
          <div
            className="relative cursor-pointer"
            onClick={() => photoInputRef.current?.click()}
          >
            <Avatar size="lg">
              {photoPreview ? (
                <AvatarImage src={photoPreview} alt="Photo" />
              ) : null}
              <AvatarFallback className="bg-muted text-muted-foreground">
                <Camera className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setPhotoPreview(url);
                  update("photo", url);
                }
              }}
            />
          </div>
          <div>
            <p className="text-sm font-medium">Borrower Photo</p>
            <p className="text-xs text-muted-foreground">
              Click to upload a photo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              placeholder="Juan"
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="middle_name">Middle Name</Label>
            <Input
              id="middle_name"
              placeholder="Dela Cruz"
              value={form.middle_name}
              onChange={(e) => update("middle_name", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              placeholder="Santos"
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Suffix</Label>
            <Select
              value={form.suffix || undefined}
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
            <Label>Birthdate *</Label>
            <Popover>
              <PopoverTrigger
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm",
                  !form.birthdate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {form.birthdate
                  ? formatDate(form.birthdate)
                  : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={
                    form.birthdate ? new Date(form.birthdate) : undefined
                  }
                  onSelect={(date) => {
                    if (date) {
                      update(
                        "birthdate",
                        date.toISOString().split("T")[0]!
                      );
                    }
                  }}
                  fromYear={1940}
                  toYear={2010}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Gender *</Label>
            <RadioGroup
              className="flex gap-4 pt-1"
              value={form.gender || undefined}
              onValueChange={(v) => update("gender", v ?? "")}
            >
              {GENDER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <RadioGroupItem value={opt.value} />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Civil Status *</Label>
          <Select
            value={form.civil_status || undefined}
            onValueChange={(v) => update("civil_status", v ?? "")}
          >
            <SelectTrigger className="w-full">
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
      </TabsContent>

      {/* Tab 2: Contact & Address */}
      <TabsContent value="contact" className="space-y-4 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Contact Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="09XXXXXXXXX"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              required
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
          <Label htmlFor="address">Street Address</Label>
          <Textarea
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
              placeholder="Brgy. name"
              value={form.barangay}
              onChange={(e) => update("barangay", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City / Municipality</Label>
            <Input
              id="city"
              placeholder="City name"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Province</Label>
            <Select
              value={form.province || undefined}
              onValueChange={(v) => update("province", v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {PHILIPPINE_PROVINCES.map((prov) => (
                  <SelectItem key={prov} value={prov}>
                    {prov}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip_code">Zip Code</Label>
            <Input
              id="zip_code"
              placeholder="1234"
              value={form.zip_code}
              onChange={(e) => update("zip_code", e.target.value)}
            />
          </div>
        </div>
      </TabsContent>

      {/* Tab 3: Employment & Income */}
      <TabsContent value="employment" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>Employment Type</Label>
          <Select
            value={form.employment_type || undefined}
            onValueChange={(v) => update("employment_type", v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select employment type" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employer">Employer / Business Name</Label>
          <Input
            id="employer"
            placeholder="Company or business name"
            value={form.employer_or_business}
            onChange={(e) => update("employer_or_business", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="income">Monthly Income (PHP)</Label>
          <Input
            id="income"
            type="number"
            min={0}
            step={100}
            placeholder="0"
            value={form.monthly_income}
            onChange={(e) => update("monthly_income", e.target.value)}
          />
        </div>
      </TabsContent>

      {/* Tab 4: ID & Documents */}
      <TabsContent value="documents" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>Valid ID Type</Label>
          <Select
            value={form.valid_id_type || undefined}
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
          <Label htmlFor="id_number">Valid ID Number</Label>
          <Input
            id="id_number"
            placeholder="ID number"
            value={form.valid_id_number}
            onChange={(e) => update("valid_id_number", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Valid ID Photo</Label>
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-brand-orange/40"
            onClick={() => idPhotoInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {idPhotoName || "Click to upload ID photo"}
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or PDF up to 5MB
            </p>
            <input
              ref={idPhotoInputRef}
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
      </TabsContent>
    </Tabs>
  );
}

// ── Add Borrower Dialog ──

export function AddBorrowerDialog({
  onAdd,
  borrowerCount,
}: {
  onAdd: (borrower: Borrower) => void;
  borrowerCount: number;
}) {
  const code = generateBorrowerCode(borrowerCount);
  const [form, setForm] = useState<BorrowerForm>(emptyForm(code));

  const update = (field: keyof BorrowerForm, value: string | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => setForm(emptyForm(generateBorrowerCode(borrowerCount)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.phone) return;

    const newBorrower: Borrower = {
      id: Date.now(),
      borrower_code: form.borrower_code,
      first_name: form.first_name,
      middle_name: form.middle_name || undefined,
      last_name: form.last_name,
      full_name: buildFullName(form),
      suffix: form.suffix || undefined,
      birthdate: form.birthdate || undefined,
      civil_status: (form.civil_status || undefined) as CivilStatus | undefined,
      gender: (form.gender || undefined) as Gender | undefined,
      email: form.email || undefined,
      contact_number: form.phone || undefined,
      address: form.address || undefined,
      employer_or_business: form.employer_or_business || undefined,
      monthly_income: form.monthly_income
        ? Number(form.monthly_income)
        : undefined,
      photo: form.photo,
      status: "active",
      total_loans: 0,
      total_outstanding: 0,
      created_at: new Date().toISOString().split("T")[0]!,
      updated_at: new Date().toISOString().split("T")[0]!,
    };
    onAdd(newBorrower);
    resetForm();
  };

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-brand-orange-foreground hover:bg-brand-orange-dark transition-colors">
        <UserPlus className="h-4 w-4" />
        Add Borrower
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add New Borrower</DialogTitle>
          <DialogDescription>
            Create a new borrower profile. Borrower code:{" "}
            <span className="font-mono font-semibold text-brand-orange">
              {form.borrower_code}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <BorrowerFormTabs form={form} update={update} />
          <div className="flex justify-end gap-3 pt-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              Create Borrower
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Borrower Dialog ──

export function EditBorrowerDialog({
  borrower,
  open,
  onOpenChange,
  onSave,
}: {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Borrower) => void;
}) {
  const [form, setForm] = useState<BorrowerForm>(borrowerToForm(borrower));

  const update = (field: keyof BorrowerForm, value: string | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...borrower,
      first_name: form.first_name,
      middle_name: form.middle_name || undefined,
      last_name: form.last_name,
      full_name: buildFullName(form),
      suffix: form.suffix || undefined,
      birthdate: form.birthdate || undefined,
      civil_status: (form.civil_status || borrower.civil_status || undefined) as CivilStatus | undefined,
      gender: (form.gender || borrower.gender || undefined) as Gender | undefined,
      email: form.email || undefined,
      contact_number: form.phone || undefined,
      address: form.address || undefined,
      employer_or_business: form.employer_or_business || undefined,
      monthly_income: form.monthly_income
        ? Number(form.monthly_income)
        : undefined,
      photo: form.photo,
      updated_at: new Date().toISOString().split("T")[0]!,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit Borrower</DialogTitle>
          <DialogDescription>
            Update profile for {borrower.full_name} —{" "}
            <span className="font-mono text-brand-orange">
              {borrower.borrower_code}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <BorrowerFormTabs form={form} update={update} />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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

// ── Toggle Status Dialog ──

export function ToggleStatusDialog({
  borrower,
  open,
  onOpenChange,
  onConfirm,
}: {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isActive = borrower.status === "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-orange" />
            {isActive ? "Deactivate" : "Activate"} Borrower
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Are you sure you want to deactivate ${borrower.full_name}? They will be marked as inactive.`
              : `Are you sure you want to activate ${borrower.full_name}? They will regain active status.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={
              isActive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-green-600 text-white hover:bg-green-700"
            }
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Borrower Dialog ──

export function DeleteBorrowerDialog({
  borrower,
  open,
  onOpenChange,
  onConfirm,
}: {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Borrower
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete {borrower.full_name} (
            {borrower.borrower_code})? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Borrower Actions Cell ──

export function BorrowerActionsCell({
  borrower,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  borrower: Borrower;
  onEdit: (updated: Borrower) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const isActive = borrower.status === "active";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenDialog("edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog("status")}>
            {isActive ? (
              <UserX className="mr-2 h-4 w-4" />
            ) : (
              <UserCheck className="mr-2 h-4 w-4" />
            )}
            {isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditBorrowerDialog
        borrower={borrower}
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSave={onEdit}
      />
      <ToggleStatusDialog
        borrower={borrower}
        open={openDialog === "status"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onToggleStatus}
      />
      <DeleteBorrowerDialog
        borrower={borrower}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onDelete}
      />
    </>
  );
}
