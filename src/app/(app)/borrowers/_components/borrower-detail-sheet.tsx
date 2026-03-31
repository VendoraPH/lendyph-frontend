"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Pencil,
  CreditCard,
} from "lucide-react";
import type { Borrower } from "@/types";
import { statusBadgeColor, formatCurrency, formatDate, getInitials } from "./utils";
import { MOCK_LOANS } from "./mock-data";
import { LOAN_STATUS_LABELS } from "@/constants";

const loanStatusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200",
  ongoing: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  defaulted: "bg-red-100 text-red-700 border-red-200",
  restructured: "bg-orange-100 text-orange-700 border-orange-200",
  rejected: "bg-red-100 text-red-500 border-red-200",
};

interface BorrowerDetailSheetProps {
  borrower: Borrower | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (borrower: Borrower) => void;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export function BorrowerDetailSheet({
  borrower,
  open,
  onOpenChange,
  onEdit,
}: BorrowerDetailSheetProps) {
  if (!borrower) return null;

  const loans = MOCK_LOANS[borrower.id] ?? [];
  const ongoingLoans = loans.filter((l) => l.status === "ongoing");
  const completedLoans = loans.filter((l) => l.status === "completed");
  const defaultedLoans = loans.filter((l) => l.status === "defaulted");
  const totalOutstanding = loans.reduce(
    (sum, l) => sum + l.outstanding_balance,
    0
  );

  const address = [
    borrower.address,
    borrower.barangay,
    borrower.city,
    borrower.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {/* Header */}
        <SheetHeader>
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {borrower.photo ? (
                <AvatarImage src={borrower.photo} alt={borrower.full_name} />
              ) : null}
              <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-lg font-semibold">
                {getInitials(borrower.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-lg">
                {borrower.full_name}
              </SheetTitle>
              <SheetDescription className="font-mono text-brand-orange">
                {borrower.borrower_code}
              </SheetDescription>
              <Badge
                variant="outline"
                className={`mt-1 ${statusBadgeColor[borrower.status]}`}
              >
                {borrower.status}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </h3>
            <div className="space-y-3">
              <InfoRow icon={Phone} label="Phone" value={borrower.phone} />
              <InfoRow icon={Mail} label="Email" value={borrower.email} />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={address || undefined}
              />
              <InfoRow
                icon={Calendar}
                label="Birthdate"
                value={
                  borrower.birthdate
                    ? formatDate(borrower.birthdate)
                    : undefined
                }
              />
              <InfoRow
                icon={Briefcase}
                label="Employer"
                value={borrower.employer_or_business}
              />
              <InfoRow
                icon={CreditCard}
                label="Monthly Income"
                value={
                  borrower.monthly_income
                    ? formatCurrency(borrower.monthly_income)
                    : undefined
                }
              />
            </div>
          </div>

          <Separator />

          {/* Loan Summary Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Loan Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Loans</p>
                <p className="text-xl font-bold">{loans.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold text-brand-orange">
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ongoing</p>
                <p className="text-xl font-bold text-green-600">
                  {ongoingLoans.length}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-bold text-gray-600">
                  {completedLoans.length}
                </p>
              </div>
            </div>
            {defaultedLoans.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-600">Defaulted Loans</p>
                <p className="text-xl font-bold text-red-700">
                  {defaultedLoans.length}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Loan History Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Loan History
            </h3>
            {loans.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Purpose</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Balance</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {loan.purpose || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {loan.released_at
                                ? formatDate(loan.released_at)
                                : "—"}{" "}
                              · {loan.term_months}mo
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {loan.outstanding_balance > 0
                            ? formatCurrency(loan.outstanding_balance)
                            : "Paid"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={loanStatusColor[loan.status]}
                          >
                            {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No loan history found.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onEdit(borrower)}
              className="flex-1 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
