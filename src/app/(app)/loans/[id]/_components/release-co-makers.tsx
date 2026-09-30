"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { coMakerName } from "@/lib/co-maker-name";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { coMakerService } from "@/services/co-maker.service";
import { loanService, type AddLoanCoMakerPayload } from "@/services/loan.service";
import type { CoMaker } from "@/types";
import type { Loan } from "@/types/loan";
import { loadLoan } from "../_lib/load-loan";
import {
  EMPTY_NEW_CO_MAKER,
  canAddLoanCoMaker,
  linkableCoMakers,
  newCoMakerPayload,
  type NewCoMakerForm,
} from "../_lib/loan-co-makers";

/** The picker's value for creating a co-maker rather than linking one. */
const NEW_CO_MAKER = "new";

interface ReleaseCoMakersProps {
  loan: Loan;
  /** Receives the loan as re-read after a co-maker is added to it. */
  onLoanChange: (loan: Loan) => void;
}

/**
 * The co-makers in the Release dialog: the ones linked to the loan and, while
 * it awaits release, a form that adds one to it, either one of the borrower's
 * registered co-makers or a new one. The list is only ever what the server
 * says: after an add the loan is re-read, never patched here.
 */
export function ReleaseCoMakers({ loan, onLoanChange }: ReleaseCoMakersProps) {
  const canRelease = usePermission().can("loans:release");
  const canAdd = canAddLoanCoMaker(loan.status, canRelease);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewCoMakerForm>(EMPTY_NEW_CO_MAKER);
  const [adding, setAdding] = useState(false);
  // The borrower's registered co-makers, read as the form opens. Left empty
  // when they can't be read (a role without `borrowers:view` gets a 403), which
  // leaves the form create-only.
  const [registered, setRegistered] = useState<CoMaker[]>([]);
  const [picked, setPicked] = useState(NEW_CO_MAKER);
  const coMakers = loan.co_makers ?? [];
  const linkable = linkableCoMakers(registered, coMakers);
  // Null for a new co-maker, and for a pick that has since been linked.
  const existing = linkable.find((cm) => String(cm.id) === picked) ?? null;
  const payload: AddLoanCoMakerPayload | null = existing
    ? { co_maker_id: existing.id }
    : newCoMakerPayload(form);
  const pickItems = [
    ...linkable.map((cm) => ({ value: String(cm.id), label: coMakerName(cm) || "—" })),
    { value: NEW_CO_MAKER, label: "New co-maker…" },
  ];

  const update = (field: keyof NewCoMakerForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const openForm = () => {
    setFormOpen(true);
    const borrowerId = loan.borrower?.id ?? loan.borrower_id;
    if (!borrowerId) return;
    coMakerService.list(borrowerId).then(
      (list) => setRegistered(Array.isArray(list) ? list : []),
      () => setRegistered([]),
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload || adding) return;
    setAdding(true);
    const added = await loanService.addCoMaker(loan.id, payload).then(
      () => true,
      (err: unknown) => {
        notifyError(err, "We couldn't add the co-maker. Please try again.");
        return false;
      },
    );
    if (!added) {
      setAdding(false);
      return;
    }
    // The co-maker is linked. A failure from here on is only the re-read, and
    // must not read as a failed add: sending a new co-maker's details again
    // would create a second co-maker.
    const reloaded = await loadLoan(loan.id, loan).catch(() => null);
    setAdding(false);
    setFormOpen(false);
    setForm(EMPTY_NEW_CO_MAKER);
    setPicked(NEW_CO_MAKER);
    if (reloaded) {
      onLoanChange(reloaded);
      notifySuccess("Co-maker added");
    } else {
      notifyWarning(
        "Co-maker added, but the page couldn't refresh",
        "Reload to see it on this loan.",
      );
    }
  };

  return (
    <section className="space-y-2" aria-labelledby="release-co-makers-title">
      <div className="flex items-center justify-between">
        <h3 id="release-co-makers-title" className="text-sm font-medium">
          Co-Maker{coMakers.length !== 1 ? "s" : ""}
          {coMakers.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              ({coMakers.length})
            </span>
          )}
        </h3>
        {canAdd && !formOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={openForm}
          >
            <Plus className="h-3 w-3" />
            Add Co-Maker
          </Button>
        )}
      </div>
      <div className="rounded-lg border bg-muted/50 p-3">
        {coMakers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No co-maker on file</p>
        ) : (
          <ul className="space-y-2">
            {coMakers.map((cm, idx) => {
              return (
                <li key={cm.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{coMakerName(cm) || "—"}</p>
                    {cm.relationship_to_borrower && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {cm.relationship_to_borrower}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Co-Maker {idx + 1}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {canAdd && formOpen && (
        <form
          onSubmit={handleAdd}
          aria-labelledby="release-add-co-maker-title"
          className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p id="release-add-co-maker-title" className="text-sm font-semibold">
              Add Co-Maker
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={adding}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {linkable.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="new-cm-pick" className="text-xs">
                Co-Maker
              </Label>
              <Select
                value={picked}
                onValueChange={(v) => setPicked(v ?? NEW_CO_MAKER)}
                items={pickItems}
                disabled={adding}
              >
                <SelectTrigger id="new-cm-pick" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pickItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!existing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-cm-first" className="text-xs">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-cm-first"
                  className="h-9"
                  autoFocus
                  required
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-cm-last" className="text-xs">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-cm-last"
                  className="h-9"
                  required
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-cm-contact" className="text-xs">
                  Contact Number
                </Label>
                <Input
                  id="new-cm-contact"
                  type="tel"
                  className="h-9"
                  placeholder="09171234567"
                  value={form.contact_number}
                  onChange={(e) => update("contact_number", e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-cm-rel" className="text-xs">
                  Relationship to Member
                </Label>
                <Input
                  id="new-cm-rel"
                  className="h-9"
                  placeholder="e.g. Sibling, Spouse"
                  value={form.relationship_to_borrower}
                  onChange={(e) => update("relationship_to_borrower", e.target.value)}
                  disabled={adding}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFormOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              disabled={adding || !payload}
            >
              {adding ? "Adding..." : "Add Co-Maker"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
