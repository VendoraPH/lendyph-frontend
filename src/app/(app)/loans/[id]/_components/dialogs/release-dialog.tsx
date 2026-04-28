"use client";

import { AlertCircle, CalendarIcon, Plus, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateObj } from "@/lib/format";
import { PAYMENT_FREQUENCY_LABELS } from "@/constants";
import type { Loan } from "@/types/loan";
import type { AmortizationRow } from "../../_lib/schedule";

interface ScheduleTotals {
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
}

interface NewCoMakerForm {
  first_name: string;
  last_name: string;
  contact_number: string;
  relationship_to_borrower: string;
}

interface ReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  borrowerName: string;
  productName: string;
  interestType: string;
  term: number;
  frequency: string;

  releaseDate: Date;
  onReleaseDateChange: (date: Date) => void;
  releaseDatePickerOpen: boolean;
  onReleaseDatePickerOpenChange: (open: boolean) => void;

  releaseSchedule: AmortizationRow[];
  scheduleTotals: ScheduleTotals;
  computedMaturityDate: Date | null;

  addCoMakerOpen: boolean;
  onAddCoMakerOpenChange: (open: boolean) => void;
  newCoMaker: NewCoMakerForm;
  onNewCoMakerChange: (
    update: (prev: NewCoMakerForm) => NewCoMakerForm,
  ) => void;
  addingCoMaker: boolean;
  onAddCoMaker: () => void;

  onConfirm: () => void;
}

export function ReleaseDialog({
  open,
  onOpenChange,
  loan,
  borrowerName,
  productName,
  interestType,
  term,
  frequency,
  releaseDate,
  onReleaseDateChange,
  releaseDatePickerOpen,
  onReleaseDatePickerOpenChange,
  releaseSchedule,
  scheduleTotals,
  computedMaturityDate,
  addCoMakerOpen,
  onAddCoMakerOpenChange,
  newCoMaker,
  onNewCoMakerChange,
  addingCoMaker,
  onAddCoMaker,
  onConfirm,
}: ReleaseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Release Loan</DialogTitle>
          <DialogDescription>
            Review the release details below before confirming. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Summary Grid */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Application Number</p>
                <p className="text-sm font-medium font-mono">{loan.application_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member</p>
                <p className="text-sm font-medium">{borrowerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loan Product</p>
                <p className="text-sm font-medium">{productName || "N/A"}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Principal Amount</p>
                <p className="text-sm font-semibold">{formatCurrency(loan.principal_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Proceeds</p>
                <p className="text-sm font-semibold text-green-600">
                  {loan.net_proceeds != null ? formatCurrency(loan.net_proceeds) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interest Rate / Type</p>
                <p className="text-sm font-medium">
                  {loan.interest_rate}% / <span className="capitalize">{interestType || "N/A"}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Term / Frequency</p>
                <p className="text-sm font-medium">
                  {term} months / {PAYMENT_FREQUENCY_LABELS[frequency as keyof typeof PAYMENT_FREQUENCY_LABELS] ?? frequency}
                </p>
              </div>
            </div>
          </div>

          {/* Co-Makers Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Co-Maker
                {(loan.co_makers?.length ?? 0) !== 1 ? "s" : ""}
                {(loan.co_makers?.length ?? 0) > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    ({loan.co_makers!.length})
                  </span>
                )}
              </Label>
              {!addCoMakerOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onAddCoMakerOpenChange(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add Co-Maker
                </Button>
              )}
            </div>
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              {(loan.co_makers?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No co-maker on file
                </p>
              ) : (
                loan.co_makers!.map((cm, idx) => {
                  const name =
                    cm.full_name ??
                    cm.name ??
                    [cm.first_name, cm.middle_name, cm.last_name, cm.suffix]
                      .filter(Boolean)
                      .join(" ");
                  return (
                    <div
                      key={cm.id ?? idx}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{name || "—"}</p>
                        {cm.relationship && (
                          <p className="text-xs text-muted-foreground">
                            {cm.relationship}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        Co-Maker {idx + 1}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
            {addCoMakerOpen && (
              <div className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Add Co-Maker</p>
                  <button
                    type="button"
                    onClick={() => onAddCoMakerOpenChange(false)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-cm-first" className="text-xs">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new-cm-first"
                      className="h-9"
                      value={newCoMaker.first_name}
                      onChange={(e) =>
                        onNewCoMakerChange((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-cm-last" className="text-xs">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new-cm-last"
                      className="h-9"
                      value={newCoMaker.last_name}
                      onChange={(e) =>
                        onNewCoMakerChange((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
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
                      value={newCoMaker.contact_number}
                      onChange={(e) =>
                        onNewCoMakerChange((prev) => ({
                          ...prev,
                          contact_number: e.target.value,
                        }))
                      }
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
                      value={newCoMaker.relationship_to_borrower}
                      onChange={(e) =>
                        onNewCoMakerChange((prev) => ({
                          ...prev,
                          relationship_to_borrower: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onAddCoMakerOpenChange(false)}
                    disabled={addingCoMaker}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                    onClick={onAddCoMaker}
                    disabled={
                      addingCoMaker ||
                      !newCoMaker.first_name.trim() ||
                      !newCoMaker.last_name.trim()
                    }
                  >
                    {addingCoMaker ? "Adding..." : "Add Co-Maker"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Release Date Picker */}
          <div className="space-y-1.5">
            <Label>Release Date</Label>
            <Popover open={releaseDatePickerOpen} onOpenChange={onReleaseDatePickerOpenChange}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span>{formatDateObj(releaseDate)}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={releaseDate}
                  onSelect={(date) => {
                    if (date) onReleaseDateChange(date);
                    onReleaseDatePickerOpenChange(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Computed dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Maturity Date</p>
              <p className="text-sm font-medium">
                {computedMaturityDate ? formatDateObj(computedMaturityDate) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">First Due Date</p>
              <p className="text-sm font-medium">
                {releaseSchedule.length > 0 ? formatDateObj(releaseSchedule[0].dueDate) : "N/A"}
              </p>
            </div>
          </div>

          {/* Amortization Preview */}
          {releaseSchedule.length > 0 && (
            <div className="space-y-2">
              <Label>Amortization Schedule Preview</Label>
              <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center sticky top-0 bg-background">#</TableHead>
                      <TableHead className="sticky top-0 bg-background">Due Date</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">Principal</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">Interest</TableHead>
                      {scheduleTotals.shareCapitalBuildUp > 0 && (
                        <TableHead className="text-right sticky top-0 bg-background">SCB</TableHead>
                      )}
                      <TableHead className="text-right sticky top-0 bg-background">Total</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {releaseSchedule.map((row) => (
                      <TableRow key={row.period}>
                        <TableCell className="text-center text-xs">{row.period}</TableCell>
                        <TableCell className="text-xs">{formatDateObj(row.dueDate)}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.principal)}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.interest)}</TableCell>
                        {scheduleTotals.shareCapitalBuildUp > 0 && (
                          <TableCell className="text-right text-xs text-brand-orange">
                            {formatCurrency(row.shareCapitalBuildUp)}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-xs font-medium">{formatCurrency(row.totalPayment)}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold text-xs">Total</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatCurrency(scheduleTotals.principal)}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatCurrency(scheduleTotals.interest)}</TableCell>
                      {scheduleTotals.shareCapitalBuildUp > 0 && (
                        <TableCell className="text-right font-semibold text-xs text-brand-orange">
                          {formatCurrency(scheduleTotals.shareCapitalBuildUp)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-bold text-xs">{formatCurrency(scheduleTotals.totalPayment)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              Releasing this loan will lock the principal, interest rate, and term.
              The borrower will receive{" "}
              <span className="font-semibold">
                {loan.net_proceeds != null ? formatCurrency(loan.net_proceeds) : formatCurrency(loan.principal_amount)}
              </span>{" "}
              as net proceeds.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={onConfirm}
          >
            <Unlock className="mr-2 h-4 w-4" />
            Confirm Release
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
