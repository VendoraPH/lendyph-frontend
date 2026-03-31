"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, Briefcase, CreditCard } from "lucide-react";
import type { Borrower, Loan } from "@/types";
import { VALID_ID_OPTIONS } from "@/constants";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface OverviewTabProps {
  borrower: Borrower;
  loans: Loan[];
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function OverviewTab({ borrower, loans }: OverviewTabProps) {
  const ongoingLoans = loans.filter((l) => l.status === "ongoing").length;
  const completedLoans = loans.filter((l) => l.status === "completed").length;
  const defaultedLoans = loans.filter((l) => l.status === "defaulted").length;
  const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding_balance, 0);
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal_amount, 0);

  const idLabel =
    VALID_ID_OPTIONS.find((o) => o.value === borrower.valid_id_type)?.label ?? borrower.valid_id_type;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Personal Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-muted-foreground" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoItem label="Full Name" value={borrower.full_name} />
          <InfoItem label="Birthdate" value={borrower.birthdate ? formatDate(borrower.birthdate) : undefined} />
          <InfoItem label="Gender" value={borrower.gender === "male" ? "Male" : "Female"} />
          <InfoItem
            label="Civil Status"
            value={borrower.civil_status ? borrower.civil_status.charAt(0).toUpperCase() + borrower.civil_status.slice(1) : undefined}
          />
          <InfoItem label="Valid ID" value={idLabel} />
          <InfoItem label="ID Number" value={borrower.valid_id_number} />
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoItem label="Street Address" value={borrower.address} />
          <InfoItem label="Barangay" value={borrower.barangay} />
          <InfoItem label="City / Municipality" value={borrower.city} />
          <InfoItem label="Province" value={borrower.province} />
          <InfoItem label="Zip Code" value={borrower.zip_code} />
          <InfoItem label="Phone" value={borrower.phone} />
        </CardContent>
      </Card>

      {/* Employment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Employment & Income
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoItem
            label="Employment Type"
            value={borrower.employment_type ? borrower.employment_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : undefined}
          />
          <InfoItem label="Employer / Business" value={borrower.employer_or_business} />
          <InfoItem label="Monthly Income" value={borrower.monthly_income ? formatCurrency(borrower.monthly_income) : undefined} />
        </CardContent>
      </Card>

      {/* Loan Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Loan Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Loans</p>
              <p className="text-2xl font-bold">{loans.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Borrowed</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPrincipal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-brand-orange">{formatCurrency(totalOutstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ongoing / Completed / Defaulted</p>
              <p className="text-2xl font-bold">
                <span className="text-green-600">{ongoingLoans}</span>
                {" / "}
                <span className="text-gray-600">{completedLoans}</span>
                {" / "}
                <span className="text-red-600">{defaultedLoans}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
