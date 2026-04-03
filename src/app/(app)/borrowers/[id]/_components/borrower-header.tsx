"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import type { Borrower } from "@/types";

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
}

export function BorrowerHeader({ borrower, onEdit }: BorrowerHeaderProps) {
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
          <Avatar size="lg">
            {borrower.photo ? (
              <AvatarImage src={borrower.photo} alt={borrower.full_name} />
            ) : null}
            <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xl font-semibold">
              {getInitials(borrower.full_name)}
            </AvatarFallback>
          </Avatar>
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
    </div>
  );
}
