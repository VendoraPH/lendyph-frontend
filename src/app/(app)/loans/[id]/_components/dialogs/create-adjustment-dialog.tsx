"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_FREQUENCY_OPTIONS } from "@/constants";
import type { LoanAdjustmentType } from "@/types";

interface CreateAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanRef: string; // loan_account_number || application_number
  defaultInterestRate?: number | string;
  defaultTermMonths?: number | string;
  actionLoading: boolean;
  type: LoanAdjustmentType;
  onTypeChange: (value: LoanAdjustmentType) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  newBalance: string;
  onNewBalanceChange: (value: string) => void;
  newInterestRate: string;
  onNewInterestRateChange: (value: string) => void;
  newTerm: string;
  onNewTermChange: (value: string) => void;
  newFrequency: string | null;
  onNewFrequencyChange: (value: string | null) => void;
  penaltyAmount: string;
  onPenaltyAmountChange: (value: string) => void;
  remarks: string;
  onRemarksChange: (value: string) => void;
  onSubmit: () => void;
}

export function CreateAdjustmentDialog({
  open,
  onOpenChange,
  loanRef,
  defaultInterestRate,
  defaultTermMonths,
  actionLoading,
  type,
  onTypeChange,
  description,
  onDescriptionChange,
  newBalance,
  onNewBalanceChange,
  newInterestRate,
  onNewInterestRateChange,
  newTerm,
  onNewTermChange,
  newFrequency,
  onNewFrequencyChange,
  penaltyAmount,
  onPenaltyAmountChange,
  remarks,
  onRemarksChange,
  onSubmit,
}: CreateAdjustmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Loan Adjustment</DialogTitle>
          <DialogDescription>
            Submit an adjustment request for loan {loanRef}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Adjustment Type <span className="text-red-500">*</span></Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v as LoanAdjustmentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restructure">Restructure</SelectItem>
                <SelectItem value="penalty_waiver">Penalty Waiver</SelectItem>
                <SelectItem value="balance_adjustment">Balance Adjustment</SelectItem>
                <SelectItem value="term_extension">Term Extension</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-description">Description</Label>
            <Input
              id="adj-description"
              placeholder="Brief description of the adjustment"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
          </div>
          {/* Dynamic fields based on adjustment type */}
          {type === "balance_adjustment" && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-new-balance">New Outstanding Balance <span className="text-red-500">*</span></Label>
              <Input
                id="adj-new-balance"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={newBalance}
                onChange={(e) => onNewBalanceChange(e.target.value)}
              />
            </div>
          )}
          {type === "restructure" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-new-rate">New Interest Rate (%)</Label>
                  <Input
                    id="adj-new-rate"
                    type="number"
                    placeholder={String(defaultInterestRate ?? "")}
                    step="0.1"
                    value={newInterestRate}
                    onChange={(e) => onNewInterestRateChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adj-new-term">New Term (months)</Label>
                  <Input
                    id="adj-new-term"
                    type="number"
                    placeholder={String(defaultTermMonths ?? "")}
                    value={newTerm}
                    onChange={(e) => onNewTermChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>New Payment Frequency</Label>
                <Select value={newFrequency ?? null} onValueChange={(v) => onNewFrequencyChange(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Keep current frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {type === "penalty_waiver" && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-penalty">Penalty Amount to Waive <span className="text-red-500">*</span></Label>
              <Input
                id="adj-penalty"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={penaltyAmount}
                onChange={(e) => onPenaltyAmountChange(e.target.value)}
              />
            </div>
          )}
          {type === "term_extension" && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-extend-term">Additional Months <span className="text-red-500">*</span></Label>
              <Input
                id="adj-extend-term"
                type="number"
                placeholder="e.g. 3"
                value={newTerm}
                onChange={(e) => onNewTermChange(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="adj-remarks">Remarks</Label>
            <Textarea
              id="adj-remarks"
              placeholder="Additional notes..."
              value={remarks}
              onChange={(e) => onRemarksChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={onSubmit}
            disabled={actionLoading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Submit Adjustment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
