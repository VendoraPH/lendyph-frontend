"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Users,
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
  BorrowerStatus,
  CivilStatus,
  Gender,
  ValidIdType,
  EmploymentType,
} from "@/types";

// ── Types ──

interface BorrowerForm {
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

// ── Mock Data ──

const INITIAL_BORROWERS: Borrower[] = [
  {
    id: 1,
    borrower_code: "BRW-20260001",
    first_name: "Rosario",
    middle_name: "Dela Cruz",
    last_name: "Santos",
    full_name: "Rosario D. Santos",
    birthdate: "1988-05-14",
    civil_status: "married",
    gender: "female",
    email: "rosario.santos@gmail.com",
    phone: "09171234567",
    address: "123 Rizal St.",
    barangay: "San Antonio",
    city: "Makati",
    province: "Metro Manila",
    zip_code: "1200",
    employer_or_business: "Jollibee Foods Corp.",
    employment_type: "employed",
    monthly_income: 28000,
    valid_id_type: "philippine_id",
    valid_id_number: "1234-5678-9012-3456",
    status: "active",
    total_loans: 3,
    total_outstanding: 15000,
    created_at: "2026-01-15",
    updated_at: "2026-03-01",
  },
  {
    id: 2,
    borrower_code: "BRW-20260002",
    first_name: "Roberto",
    last_name: "Garcia",
    full_name: "Roberto Garcia",
    birthdate: "1975-11-22",
    civil_status: "married",
    gender: "male",
    phone: "09181234567",
    address: "45 Mabini Ave.",
    barangay: "Poblacion",
    city: "Cebu City",
    province: "Cebu",
    zip_code: "6000",
    employer_or_business: "Garcia Sari-Sari Store",
    employment_type: "self_employed",
    monthly_income: 35000,
    valid_id_type: "drivers_license",
    valid_id_number: "N01-12-345678",
    status: "active",
    total_loans: 5,
    total_outstanding: 42000,
    created_at: "2026-01-20",
    updated_at: "2026-02-15",
  },
  {
    id: 3,
    borrower_code: "BRW-20260003",
    first_name: "Maria",
    middle_name: "Lopez",
    last_name: "Reyes",
    full_name: "Maria L. Reyes",
    suffix: "Jr.",
    birthdate: "1992-08-03",
    civil_status: "single",
    gender: "female",
    email: "maria.reyes@gmail.com",
    phone: "09191234567",
    address: "789 Bonifacio St.",
    barangay: "Sta. Cruz",
    city: "Davao City",
    province: "Davao del Sur",
    zip_code: "8000",
    employer_or_business: "SM Retail Inc.",
    employment_type: "employed",
    monthly_income: 22000,
    valid_id_type: "sss",
    valid_id_number: "34-1234567-8",
    status: "active",
    total_loans: 1,
    total_outstanding: 8000,
    created_at: "2026-02-01",
    updated_at: "2026-03-15",
  },
  {
    id: 4,
    borrower_code: "BRW-20260004",
    first_name: "Eduardo",
    last_name: "Mendoza",
    full_name: "Eduardo Mendoza",
    birthdate: "1980-03-18",
    civil_status: "widowed",
    gender: "male",
    phone: "09201234567",
    address: "12 Aguinaldo Rd.",
    barangay: "San Isidro",
    city: "Malolos",
    province: "Bulacan",
    zip_code: "3000",
    employer_or_business: "OFW — Saudi Arabia",
    employment_type: "ofw",
    monthly_income: 65000,
    valid_id_type: "passport",
    valid_id_number: "P1234567A",
    status: "active",
    total_loans: 2,
    total_outstanding: 28000,
    created_at: "2026-02-10",
    updated_at: "2026-03-20",
  },
  {
    id: 5,
    borrower_code: "BRW-20260005",
    first_name: "Carmen",
    middle_name: "Aquino",
    last_name: "Torres",
    full_name: "Carmen A. Torres",
    birthdate: "1995-12-25",
    civil_status: "separated",
    gender: "female",
    email: "carmen.torres@yahoo.com",
    phone: "09211234567",
    address: "56 Luna St.",
    barangay: "Bagumbayan",
    city: "Binan",
    province: "Laguna",
    zip_code: "4024",
    employment_type: "unemployed",
    status: "inactive",
    total_loans: 1,
    total_outstanding: 0,
    created_at: "2026-03-01",
    updated_at: "2026-03-25",
  },
  {
    id: 6,
    borrower_code: "BRW-20260006",
    first_name: "Danilo",
    last_name: "Villanueva",
    full_name: "Danilo Villanueva",
    birthdate: "1970-07-09",
    civil_status: "married",
    gender: "male",
    phone: "09221234567",
    address: "33 Quezon Blvd.",
    barangay: "Sampaguita",
    city: "Angeles City",
    province: "Pampanga",
    zip_code: "2009",
    employer_or_business: "Villanueva Trading",
    employment_type: "self_employed",
    monthly_income: 50000,
    valid_id_type: "umid",
    valid_id_number: "0012-3456789-0",
    status: "blacklisted",
    total_loans: 4,
    total_outstanding: 95000,
    created_at: "2026-01-05",
    updated_at: "2026-03-28",
  },
];

// ── Constants ──

const statusBadgeColor: Record<BorrowerStatus, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
  blacklisted: "bg-gray-900 text-white border-gray-700",
};

function generateBorrowerCode(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `BRW-${year}${seq}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildFullName(form: BorrowerForm): string {
  const middle = form.middle_name ? ` ${form.middle_name.charAt(0)}.` : "";
  const suffix = form.suffix ? ` ${form.suffix}` : "";
  return `${form.first_name}${middle} ${form.last_name}${suffix}`.trim();
}

function emptyForm(code: string): BorrowerForm {
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

function borrowerToForm(b: Borrower): BorrowerForm {
  return {
    borrower_code: b.borrower_code,
    first_name: b.first_name,
    middle_name: b.middle_name ?? "",
    last_name: b.last_name,
    suffix: b.suffix ?? "",
    birthdate: b.birthdate,
    civil_status: b.civil_status,
    gender: b.gender,
    email: b.email ?? "",
    phone: b.phone,
    address: b.address ?? "",
    barangay: b.barangay ?? "",
    city: b.city ?? "",
    province: b.province ?? "",
    zip_code: b.zip_code ?? "",
    employer_or_business: b.employer_or_business ?? "",
    employment_type: b.employment_type ?? "",
    monthly_income: b.monthly_income?.toString() ?? "",
    valid_id_type: b.valid_id_type ?? "",
    valid_id_number: b.valid_id_number ?? "",
    photo: b.photo,
    valid_id_photo: b.valid_id_photo,
  };
}

// ── Borrower Form Tabs ──

function BorrowerFormTabs({
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

function AddBorrowerDialog({
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
      birthdate: form.birthdate,
      civil_status: (form.civil_status || "single") as CivilStatus,
      gender: (form.gender || "male") as Gender,
      email: form.email || undefined,
      phone: form.phone,
      address: form.address || undefined,
      barangay: form.barangay || undefined,
      city: form.city || undefined,
      province: form.province || undefined,
      zip_code: form.zip_code || undefined,
      employer_or_business: form.employer_or_business || undefined,
      employment_type: (form.employment_type || undefined) as
        | EmploymentType
        | undefined,
      monthly_income: form.monthly_income
        ? Number(form.monthly_income)
        : undefined,
      valid_id_type: (form.valid_id_type || undefined) as
        | ValidIdType
        | undefined,
      valid_id_number: form.valid_id_number || undefined,
      valid_id_photo: form.valid_id_photo,
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

function EditBorrowerDialog({
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
      birthdate: form.birthdate,
      civil_status: (form.civil_status || borrower.civil_status) as CivilStatus,
      gender: (form.gender || borrower.gender) as Gender,
      email: form.email || undefined,
      phone: form.phone,
      address: form.address || undefined,
      barangay: form.barangay || undefined,
      city: form.city || undefined,
      province: form.province || undefined,
      zip_code: form.zip_code || undefined,
      employer_or_business: form.employer_or_business || undefined,
      employment_type: (form.employment_type || undefined) as
        | EmploymentType
        | undefined,
      monthly_income: form.monthly_income
        ? Number(form.monthly_income)
        : undefined,
      valid_id_type: (form.valid_id_type || undefined) as
        | ValidIdType
        | undefined,
      valid_id_number: form.valid_id_number || undefined,
      valid_id_photo: form.valid_id_photo,
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

function ToggleStatusDialog({
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

function DeleteBorrowerDialog({
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

function BorrowerActionsCell({
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

// ── Main Page ──

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>(INITIAL_BORROWERS);
  const [search, setSearch] = useState("");

  const filteredBorrowers = borrowers.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.full_name.toLowerCase().includes(q) ||
      b.borrower_code.toLowerCase().includes(q) ||
      b.phone.includes(q) ||
      (b.city?.toLowerCase().includes(q) ?? false) ||
      (b.employer_or_business?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleAdd = (newBorrower: Borrower) => {
    setBorrowers((prev) => [newBorrower, ...prev]);
  };

  const handleEdit = (updated: Borrower) => {
    setBorrowers((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  };

  const handleToggleStatus = (id: number) => {
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: (b.status === "active"
                ? "inactive"
                : "active") as BorrowerStatus,
            }
          : b
      )
    );
  };

  const handleDelete = (id: number) => {
    setBorrowers((prev) => prev.filter((b) => b.id !== id));
  };

  const activeCount = borrowers.filter((b) => b.status === "active").length;
  const inactiveCount = borrowers.filter((b) => b.status === "inactive").length;
  const blacklistedCount = borrowers.filter(
    (b) => b.status === "blacklisted"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Borrower Management
          </h1>
          <p className="text-muted-foreground">
            Create, edit, and manage borrower profiles
          </p>
        </div>
        <AddBorrowerDialog
          onAdd={handleAdd}
          borrowerCount={borrowers.length}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Borrowers
                </p>
                <p className="text-2xl font-bold">{borrowers.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-red-600">{inactiveCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Blacklisted</p>
            <p className="text-2xl font-bold">{blacklistedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Borrowers Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            All Borrowers ({filteredBorrowers.length})
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search borrowers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Employment</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBorrowers.map((borrower) => (
                  <TableRow key={borrower.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          {borrower.photo ? (
                            <AvatarImage
                              src={borrower.photo}
                              alt={borrower.full_name}
                            />
                          ) : null}
                          <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xs font-semibold">
                            {getInitials(borrower.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{borrower.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {borrower.borrower_code}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {borrower.phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[borrower.city, borrower.province]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {borrower.employer_or_business || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {borrower.monthly_income
                        ? formatCurrency(borrower.monthly_income)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeColor[borrower.status]}
                      >
                        {borrower.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <BorrowerActionsCell
                        borrower={borrower}
                        onEdit={handleEdit}
                        onToggleStatus={() =>
                          handleToggleStatus(borrower.id)
                        }
                        onDelete={() => handleDelete(borrower.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBorrowers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No borrowers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
