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
import type { CreateCoMakerData } from "@/services/co-maker.service";
import { VALID_ID_OPTIONS } from "@/constants";
import { AddCoMakerDialog, EditCoMakerDialog } from "./co-maker-form-dialog";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

interface CoMakersTabProps {
  coMakers: CoMaker[];
  loans: Loan[];
  borrowerId: number;
  onAdd: (data: CreateCoMakerData) => void;
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
          existingCoMakers={coMakers}
          onAdd={onAdd}
        />
      </div>

      {/* Empty state */}
      {coMakers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No co-makers on file for this member.</p>
            <p className="text-xs mt-1">Click &quot;Add Co-Maker&quot; above to register one.</p>
          </CardContent>
        </Card>
      )}

      {/* Co-maker cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {coMakers.map((cm) => {
          const loan = cm.loan_id ? loanMap.get(cm.loan_id) : undefined;
          const idLabel =
            VALID_ID_OPTIONS.find((o) => o.value === cm.valid_id_type)?.label ??
            cm.valid_id_type;

          return (
            <Card key={cm.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{cm.full_name ?? cm.name ?? ([cm.first_name, cm.middle_name, cm.last_name, cm.suffix].filter(Boolean).join(" ") || "—")}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">{cm.relationship_to_borrower ?? cm.relationship ?? "—"}</p>
                    {cm.co_maker_code && <p className="text-xs text-muted-foreground font-mono">{cm.co_maker_code}</p>}
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
                  {cm.contact_number ?? cm.phone ?? "—"}
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
