"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, CreditCard, Users } from "lucide-react";
import type { CoMaker, Loan } from "@/types";
import { VALID_ID_OPTIONS } from "@/constants";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

interface CoMakersTabProps {
  coMakers: CoMaker[];
  loans: Loan[];
}

export function CoMakersTab({ coMakers, loans }: CoMakersTabProps) {
  const loanMap = new Map(loans.map((l) => [l.id, l]));

  if (coMakers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No co-makers on file for this borrower.</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
                </div>
                {loan && (
                  <Badge variant="outline" className="text-xs">
                    {loan.purpose ?? `Loan #${loan.id}`} · {formatCurrency(loan.principal_amount)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
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
              {cm.valid_id_type && (
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {idLabel}
                  {cm.valid_id_number && (
                    <span className="text-muted-foreground font-mono text-xs">{cm.valid_id_number}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
