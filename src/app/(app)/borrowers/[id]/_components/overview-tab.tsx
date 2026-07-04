"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, Briefcase, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Borrower, Loan, CoMaker } from "@/types";
// Constants removed — valid_id_type not in API response

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface OverviewTabProps {
  borrower: Borrower;
  loans: Loan[];
  coMakers: CoMaker[];
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function OverviewTab({ borrower, loans, coMakers }: OverviewTabProps) {
  // "Current" in this count also includes legacy "ongoing" responses, since
  // older backend versions emit that status for the same lifecycle stage.
  const currentLoans = loans.filter(
    (l) => l.status === "current" || l.status === "ongoing"
  ).length;
  const completedLoans = loans.filter((l) => l.status === "completed").length;
  const defaultedLoans = loans.filter((l) => l.status === "defaulted").length;
  const totalOutstanding = loans.reduce((sum, l) => sum + (l.outstanding_balance ?? 0), 0);
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal_amount, 0);

  const totalCoMakers = coMakers.length;
  const loansNeedingCoMaker = loans.filter(
    (l) => l.principal_amount >= 50000 && l.status !== "completed" && !coMakers.some((cm) => cm.loan_id === l.id)
  ).length;

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
          <InfoItem label="Gender" value={borrower.gender ? (borrower.gender === "male" ? "Male" : "Female") : undefined} />
          <InfoItem
            label="Civil Status"
            value={borrower.civil_status ? borrower.civil_status.charAt(0).toUpperCase() + borrower.civil_status.slice(1) : undefined}
          />
          <InfoItem label="Borrower Code" value={borrower.borrower_code} />
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
          <InfoItem label="Address" value={borrower.address} />
          <InfoItem label="Contact Number" value={borrower.contact_number || borrower.phone} />
          <InfoItem label="Email" value={borrower.email} />
          <InfoItem label="Branch" value={borrower.branch?.name} />
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
          <InfoItem label="Employer / Business" value={borrower.employer_or_business} />
          <InfoItem label="Monthly Income" value={borrower.monthly_income ? formatCurrency(Number(borrower.monthly_income)) : undefined} />
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
              <p className="text-xs text-muted-foreground">Current / Completed / Defaulted</p>
              <p className="text-2xl font-bold">
                <span className="text-green-600">{currentLoans}</span>
                {" / "}
                <span className="text-gray-600">{completedLoans}</span>
                {" / "}
                <span className="text-red-600">{defaultedLoans}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Co-Makers</p>
              <p className="text-2xl font-bold">{totalCoMakers}</p>
            </div>
            {loansNeedingCoMaker > 0 && (
              <div>
                <p className="text-xs text-amber-500">Loans Needing Co-Maker</p>
                <p className="text-2xl font-bold text-amber-500">{loansNeedingCoMaker}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
