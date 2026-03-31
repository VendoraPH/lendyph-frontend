# Co-Maker Profile Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a co-maker registration form that allows creating, editing, and deleting co-makers linked to borrowers and loans, with ID upload and all required fields.

**Architecture:** Expand the `CoMaker` type with new fields (co_maker_code, occupation, employer, monthly_income, photo, valid_id_photo). Add relationship constants. Create an add/edit dialog component and integrate it into the existing Co-Makers tab on the borrower detail page. Add edit/delete actions to each co-maker card. The detail page manages co-maker state and passes handlers down.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, base-ui Dialog, lucide-react, existing UI components.

---

## File Structure

```
src/types/co-maker.ts                                         — expand with new fields
src/constants/index.ts                                         — add RELATIONSHIP_OPTIONS
src/app/(dashboard)/borrowers/[id]/_components/
  co-maker-form-dialog.tsx                                     — add/edit dialog with form
  co-makers-tab.tsx                                            — add button, edit/delete actions on cards
  mock-detail-data.ts                                          — update mock data for new fields
src/app/(dashboard)/borrowers/[id]/page.tsx                    — manage co-maker state, pass handlers
```

---

### Task 1: Expand CoMaker Type and Add Constants

**Files:**
- Modify: `src/types/co-maker.ts`
- Modify: `src/constants/index.ts`

Since this branch (`feat/co-maker-profile-form`) was created from `development` which does NOT have the co-maker type yet, we need to create it fresh here.

- [ ] **Step 1: Create/update co-maker.ts**

The file may not exist on this branch. Create it with the full expanded type:

```ts
import type { ValidIdType } from "./borrower";

export type CoMakerRelationship =
  | "spouse"
  | "parent"
  | "sibling"
  | "relative"
  | "friend"
  | "colleague"
  | "other";

export interface CoMaker {
  id: number;
  co_maker_code: string;
  borrower_id: number;
  loan_id: number;
  full_name: string;
  relationship: CoMakerRelationship;
  phone: string;
  address?: string;
  occupation?: string;
  employer?: string;
  monthly_income?: number;
  valid_id_type?: ValidIdType;
  valid_id_number?: string;
  valid_id_photo?: string;
  photo?: string;
  created_at: string;
}
```

- [ ] **Step 2: Update types/index.ts to export CoMaker and CoMakerRelationship**

Read the current `src/types/index.ts` on this branch. Add this line (after the Payment export or at the end):

```ts
export type { CoMaker, CoMakerRelationship } from "./co-maker";
```

Also ensure all the type exports needed are present. On `development`, `src/types/borrower.ts` has a minimal Borrower interface. This branch needs the expanded types. Check if CivilStatus, Gender, BorrowerStatus, ValidIdType, EmploymentType are exported from borrower.ts. If not, add them (same as feat/borrower-profile-detail branch).

- [ ] **Step 3: Add RELATIONSHIP_OPTIONS to constants**

Read `src/constants/index.ts`. Add this constant (place it near other option arrays, or at the end before the exports):

```ts
export const RELATIONSHIP_OPTIONS = [
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "relative", label: "Relative" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "other", label: "Other" },
] as const;
```

Also ensure `VALID_ID_OPTIONS` exists in constants. If it doesn't (because `development` branch may not have it), add it:

```ts
export const VALID_ID_OPTIONS = [
  { value: "philippine_id", label: "Philippine National ID (PhilSys)" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
  { value: "sss", label: "SSS ID" },
  { value: "umid", label: "UMID" },
  { value: "voters_id", label: "Voter's ID" },
  { value: "postal_id", label: "Postal ID" },
  { value: "prc_id", label: "PRC ID" },
  { value: "tin_id", label: "TIN ID" },
] as const;
```

- [ ] **Step 4: Commit**

```bash
git add src/types/co-maker.ts src/types/index.ts src/constants/index.ts
git commit -m "feat: expand CoMaker type with employment, ID upload, and relationship fields"
```

---

### Task 2: Create Co-Maker Form Dialog

**Files:**
- Create: `src/app/(dashboard)/borrowers/[id]/_components/co-maker-form-dialog.tsx`

- [ ] **Step 1: Create co-maker-form-dialog.tsx**

```tsx
"use client";

import { useState, useRef } from "react";
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
import { UserPlus, Upload } from "lucide-react";
import { RELATIONSHIP_OPTIONS, VALID_ID_OPTIONS } from "@/constants";
import type { CoMaker, CoMakerRelationship, Loan, ValidIdType } from "@/types";

interface CoMakerFormData {
  full_name: string;
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
    full_name: "",
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
  return {
    full_name: cm.full_name,
    relationship: cm.relationship,
    phone: cm.phone,
    address: cm.address ?? "",
    occupation: cm.occupation ?? "",
    employer: cm.employer ?? "",
    monthly_income: cm.monthly_income?.toString() ?? "",
    valid_id_type: cm.valid_id_type ?? "",
    valid_id_number: cm.valid_id_number ?? "",
    valid_id_photo: cm.valid_id_photo,
    photo: cm.photo,
    loan_id: cm.loan_id,
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
  onAdd: (coMaker: CoMaker) => void;
}

export function AddCoMakerDialog({
  loans,
  borrowerId,
  coMakerCount,
  onAdd,
}: AddCoMakerDialogProps) {
  const [form, setForm] = useState<CoMakerFormData>(emptyForm());
  const [open, setOpen] = useState(false);
  const idPhotoRef = useRef<HTMLInputElement>(null);
  const [idPhotoName, setIdPhotoName] = useState("");

  const update = (field: keyof CoMakerFormData, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm(emptyForm());
    setIdPhotoName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.relationship || !form.phone || !form.loan_id) return;

    const newCoMaker: CoMaker = {
      id: Date.now(),
      co_maker_code: generateCoMakerCode(coMakerCount),
      borrower_id: borrowerId,
      loan_id: form.loan_id as number,
      full_name: form.full_name,
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
      created_at: new Date().toISOString().split("T")[0]!,
    };
    onAdd(newCoMaker);
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
        <CoMakerFormFields
          form={form}
          update={update}
          loans={loans}
          idPhotoRef={idPhotoRef}
          idPhotoName={idPhotoName}
          setIdPhotoName={setIdPhotoName}
        />
        <form onSubmit={handleSubmit}>
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
  const [form, setForm] = useState<CoMakerFormData>(coMakerToForm(coMaker));
  const idPhotoRef = useRef<HTMLInputElement>(null);
  const [idPhotoName, setIdPhotoName] = useState("");

  const update = (field: keyof CoMakerFormData, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.relationship || !form.phone || !form.loan_id) return;

    onSave({
      ...coMaker,
      full_name: form.full_name,
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
          <DialogTitle>Edit Co-Maker</DialogTitle>
          <DialogDescription>
            Update co-maker profile for {coMaker.full_name} —{" "}
            <span className="font-mono text-brand-orange">{coMaker.co_maker_code}</span>
          </DialogDescription>
        </DialogHeader>
        <CoMakerFormFields
          form={form}
          update={update}
          loans={loans}
          idPhotoRef={idPhotoRef}
          idPhotoName={idPhotoName}
          setIdPhotoName={setIdPhotoName}
        />
        <form onSubmit={handleSubmit}>
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function CoMakerFormFields({
  form,
  update,
  loans,
  idPhotoRef,
  idPhotoName,
  setIdPhotoName,
}: {
  form: CoMakerFormData;
  update: (field: keyof CoMakerFormData, value: string | number | undefined) => void;
  loans: Loan[];
  idPhotoRef: React.RefObject<HTMLInputElement | null>;
  idPhotoName: string;
  setIdPhotoName: (name: string) => void;
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
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_full_name">Full Name *</Label>
          <Input
            id="cm_full_name"
            placeholder="Juan Dela Cruz"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Relationship to Borrower *</Label>
          <Select
            value={form.relationship || undefined}
            onValueChange={(v) => update("relationship", v)}
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
            value={form.valid_id_type || undefined}
            onValueChange={(v) => update("valid_id_type", v)}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/co-maker-form-dialog.tsx
git commit -m "feat: add co-maker form dialog with add and edit modes"
```

---

### Task 3: Update Co-Makers Tab with Add/Edit/Delete Actions

**Files:**
- Modify: `src/app/(dashboard)/borrowers/[id]/_components/co-makers-tab.tsx`

This task replaces the existing co-makers-tab with a version that includes:
- An "Add Co-Maker" button at the top
- Edit and Delete buttons on each co-maker card
- A delete confirmation dialog

- [ ] **Step 1: Rewrite co-makers-tab.tsx**

Since the file may not exist on this branch (it was created on `feat/borrower-profile-detail`), create it fresh. If it exists, replace entirely.

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Phone, MapPin, CreditCard, Users, Pencil, Trash2, Briefcase, Banknote, AlertTriangle } from "lucide-react";
import type { CoMaker, Loan } from "@/types";
import { VALID_ID_OPTIONS } from "@/constants";
import { AddCoMakerDialog, EditCoMakerDialog } from "./co-maker-form-dialog";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

interface CoMakersTabProps {
  coMakers: CoMaker[];
  loans: Loan[];
  borrowerId: number;
  onAdd: (coMaker: CoMaker) => void;
  onEdit: (updated: CoMaker) => void;
  onDelete: (id: number) => void;
}

export function CoMakersTab({
  coMakers,
  loans,
  borrowerId,
  onAdd,
  onEdit,
  onDelete,
}: CoMakersTabProps) {
  const loanMap = new Map(loans.map((l) => [l.id, l]));
  const [editingCoMaker, setEditingCoMaker] = useState<CoMaker | null>(null);
  const [deletingCoMaker, setDeletingCoMaker] = useState<CoMaker | null>(null);

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {coMakers.length} co-maker{coMakers.length !== 1 ? "s" : ""} on file
        </p>
        <AddCoMakerDialog
          loans={loans}
          borrowerId={borrowerId}
          coMakerCount={coMakers.length}
          onAdd={onAdd}
        />
      </div>

      {/* Empty state */}
      {coMakers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No co-makers on file for this borrower.</p>
            <p className="text-xs mt-1">Click "Add Co-Maker" above to register one.</p>
          </CardContent>
        </Card>
      )}

      {/* Co-maker cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {coMakers.map((cm) => {
          const loan = loanMap.get(cm.loan_id);
          const idLabel =
            VALID_ID_OPTIONS.find((o) => o.value === cm.valid_id_type)?.label ??
            cm.valid_id_type;

          return (
            <Card key={cm.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{cm.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{cm.relationship}</p>
                    <p className="text-xs text-muted-foreground font-mono">{cm.co_maker_code}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {loan && (
                      <Badge variant="outline" className="text-xs mr-2">
                        {loan.purpose ?? `Loan #${loan.id}`}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingCoMaker(cm)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingCoMaker(cm)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {cm.phone}
                </div>
                {cm.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    {cm.address}
                  </div>
                )}
                {cm.occupation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    {cm.occupation}
                    {cm.employer && <span className="text-muted-foreground">at {cm.employer}</span>}
                  </div>
                )}
                {cm.monthly_income && (
                  <div className="flex items-center gap-2 text-sm">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    {formatCurrency(cm.monthly_income)}/mo
                  </div>
                )}
                {cm.valid_id_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    {idLabel}
                    {cm.valid_id_number && (
                      <span className="text-muted-foreground font-mono text-xs">
                        {cm.valid_id_number}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit dialog */}
      {editingCoMaker && (
        <EditCoMakerDialog
          coMaker={editingCoMaker}
          loans={loans}
          open={!!editingCoMaker}
          onOpenChange={(v) => { if (!v) setEditingCoMaker(null); }}
          onSave={(updated) => {
            onEdit(updated);
            setEditingCoMaker(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deletingCoMaker && (
        <Dialog open={!!deletingCoMaker} onOpenChange={(v) => { if (!v) setDeletingCoMaker(null); }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Co-Maker
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deletingCoMaker.full_name} ({deletingCoMaker.co_maker_code})?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeletingCoMaker(null)}>Cancel</Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  onDelete(deletingCoMaker.id);
                  setDeletingCoMaker(null);
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/co-makers-tab.tsx
git commit -m "feat: update co-makers tab with add, edit, and delete actions"
```

---

### Task 4: Update Detail Page to Manage Co-Maker State

**Files:**
- Modify: `src/app/(dashboard)/borrowers/[id]/page.tsx`

Since this branch is from `development`, the `[id]/page.tsx` may not exist. If it does not, create it. If it does, update it. The page needs to:
- Import and provide co-maker state with add/edit/delete handlers
- Pass `borrowerId`, `onAdd`, `onEdit`, `onDelete` to `CoMakersTab`

The full page needs all the tab components. Since this branch is from `development`, you'll need to bring over the complete detail page structure. Check if the file exists first.

- [ ] **Step 1: Create or update [id]/page.tsx**

If the file doesn't exist, create the full page. If it exists, update the co-makers section.

The key changes from the base detail page:
1. Add `coMakers` as state (not just derived from mock data)
2. Add handlers: `handleAddCoMaker`, `handleEditCoMaker`, `handleDeleteCoMaker`
3. Pass new props to `CoMakersTab`

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Borrower, CoMaker } from "@/types";
import { INITIAL_BORROWERS, MOCK_LOANS } from "../_components/mock-data";
import { MOCK_PAYMENTS, MOCK_CO_MAKERS } from "./_components/mock-detail-data";
import { BorrowerHeader } from "./_components/borrower-header";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { CoMakersTab } from "./_components/co-makers-tab";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = Number(params.id);

  const [borrower, setBorrower] = useState<Borrower | undefined>(() =>
    INITIAL_BORROWERS.find((b) => b.id === borrowerId)
  );
  const [coMakers, setCoMakers] = useState<CoMaker[]>(
    () => MOCK_CO_MAKERS[borrowerId] ?? []
  );

  if (!borrower) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Borrower not found.</p>
      </div>
    );
  }

  const loans = MOCK_LOANS[borrower.id] ?? [];
  const payments = MOCK_PAYMENTS[borrower.id] ?? [];

  const handleAddCoMaker = (newCoMaker: CoMaker) => {
    setCoMakers((prev) => [...prev, newCoMaker]);
  };

  const handleEditCoMaker = (updated: CoMaker) => {
    setCoMakers((prev) =>
      prev.map((cm) => (cm.id === updated.id ? updated : cm))
    );
  };

  const handleDeleteCoMaker = (id: number) => {
    setCoMakers((prev) => prev.filter((cm) => cm.id !== id));
  };

  return (
    <div className="space-y-6">
      <BorrowerHeader
        borrower={borrower}
        onEdit={() => {}}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="co-makers">Co-Makers ({coMakers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab borrower={borrower} loans={loans} />
        </TabsContent>

        <TabsContent value="loans" className="pt-4">
          <LoansTab loans={loans} />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <PaymentsTab payments={payments} loans={loans} />
        </TabsContent>

        <TabsContent value="co-makers" className="pt-4">
          <CoMakersTab
            coMakers={coMakers}
            loans={loans}
            borrowerId={borrower.id}
            onAdd={handleAddCoMaker}
            onEdit={handleEditCoMaker}
            onDelete={handleDeleteCoMaker}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

NOTE: This page depends on multiple components that may not exist on the `development` branch. The implementer must check and bring over from `feat/borrower-profile-detail` if needed:
- `../_components/mock-data.ts` (INITIAL_BORROWERS, MOCK_LOANS)
- `./_components/mock-detail-data.ts` (MOCK_PAYMENTS, MOCK_CO_MAKERS)
- `./_components/borrower-header.tsx`
- `./_components/overview-tab.tsx`
- `./_components/loans-tab.tsx`
- `./_components/payments-tab.tsx`

If these files don't exist, copy them from the `feat/borrower-profile-detail` branch using:
```bash
git show feat/borrower-profile-detail:<path> > <path>
```

Also bring over the parent `_components/` files if missing:
- `../borrowers/_components/utils.ts`
- `../borrowers/_components/mock-data.ts`
- `../borrowers/_components/borrower-actions.tsx`
- `../borrowers/_components/borrower-filters.tsx`
- `../borrowers/_components/borrower-table.tsx`
- `../borrowers/page.tsx`

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: wire co-maker state management into borrower detail page"
```

---

### Task 5: Update Mock Data for New CoMaker Fields

**Files:**
- Modify: `src/app/(dashboard)/borrowers/[id]/_components/mock-detail-data.ts`

Update the MOCK_CO_MAKERS entries to include the new fields (co_maker_code, occupation, employer, monthly_income).

- [ ] **Step 1: Update mock co-maker data**

If the file exists, find the `MOCK_CO_MAKERS` section and update each entry. If it doesn't exist, it would have been brought over in Task 4 — update the co-makers section.

Update each co-maker to include:
```ts
// Borrower 1's co-maker
{
  id: 1,
  co_maker_code: "CM-20260001",
  borrower_id: 1,
  loan_id: 102,
  full_name: "Ricardo Santos",
  relationship: "spouse",
  phone: "09171234568",
  address: "123 Rizal St., San Antonio, Makati, Metro Manila",
  occupation: "Electrician",
  employer: "Santos Electric Services",
  monthly_income: 25000,
  valid_id_type: "philippine_id",
  valid_id_number: "9876-5432-1098-7654",
  created_at: "2026-02-10",
}

// Borrower 2's co-makers
{
  id: 2,
  co_maker_code: "CM-20260002",
  borrower_id: 2,
  loan_id: 203,
  full_name: "Elena Garcia",
  relationship: "spouse",
  phone: "09181234568",
  address: "45 Mabini Ave., Poblacion, Cebu City",
  occupation: "Teacher",
  employer: "Cebu City National High School",
  monthly_income: 22000,
  valid_id_type: "voters_id",
  valid_id_number: "VIN-2345678",
  created_at: "2026-01-20",
},
{
  id: 3,
  co_maker_code: "CM-20260003",
  borrower_id: 2,
  loan_id: 204,
  full_name: "Pedro Garcia",
  relationship: "sibling",
  phone: "09181234569",
  address: "50 Mabini Ave., Poblacion, Cebu City",
  occupation: "Seaman",
  employer: "Pacific Maritime Corp.",
  monthly_income: 45000,
  valid_id_type: "drivers_license",
  valid_id_number: "N02-12-345679",
  created_at: "2026-02-15",
}

// Borrower 4's co-maker
{
  id: 4,
  co_maker_code: "CM-20260004",
  borrower_id: 4,
  loan_id: 402,
  full_name: "Gloria Mendoza",
  relationship: "sibling",
  phone: "09201234568",
  address: "14 Aguinaldo Rd., San Isidro, Malolos, Bulacan",
  occupation: "Nurse",
  employer: "Bulacan Medical Center",
  monthly_income: 30000,
  valid_id_type: "sss",
  valid_id_number: "34-7654321-0",
  created_at: "2026-02-01",
}

// Borrower 6's co-maker
{
  id: 5,
  co_maker_code: "CM-20260005",
  borrower_id: 6,
  loan_id: 601,
  full_name: "Rosa Villanueva",
  relationship: "spouse",
  phone: "09221234568",
  address: "33 Quezon Blvd., Sampaguita, Angeles City, Pampanga",
  occupation: "Store Manager",
  employer: "Villanueva Trading",
  monthly_income: 20000,
  valid_id_type: "umid",
  valid_id_number: "0012-3456790-0",
  created_at: "2025-10-01",
}
```

Borrowers 3 and 5 keep empty arrays.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/borrowers/\[id\]/_components/mock-detail-data.ts
git commit -m "feat: update mock co-maker data with employment and code fields"
```

---

### Task 6: Build Check and Polish

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (ignore .next/types cache errors)

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: polish co-maker profile form"
```
