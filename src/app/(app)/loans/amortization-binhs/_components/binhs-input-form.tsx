"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BinhsInput } from "@/lib/binhs";

interface Props {
  value: BinhsInput;
  onChange: (next: BinhsInput) => void;
}

export function BinhsInputForm({ value, onChange }: Props) {
  const update = (patch: Partial<BinhsInput>) =>
    onChange({ ...value, ...patch });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Inputs</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="binhs-principal">Principal (₱)</Label>
          <Input
            id="binhs-principal"
            type="number"
            min={0}
            step="0.01"
            value={value.principal}
            onChange={(e) =>
              update({ principal: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="binhs-rate">Annual interest rate (%)</Label>
          <Input
            id="binhs-rate"
            type="number"
            min={0}
            step="0.01"
            value={value.annualInterestRate}
            onChange={(e) =>
              update({ annualInterestRate: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="binhs-term">Term (months)</Label>
          <Input
            id="binhs-term"
            type="number"
            min={1}
            max={60}
            step="1"
            value={value.termMonths}
            onChange={(e) =>
              update({ termMonths: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="binhs-scbu">Share Capital Build-Up per period (₱)</Label>
          <Input
            id="binhs-scbu"
            type="number"
            min={0}
            step="0.01"
            value={value.scbuPerPeriod}
            onChange={(e) =>
              update({ scbuPerPeriod: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="binhs-start">First due date</Label>
          <Input
            id="binhs-start"
            type="date"
            value={value.startDate}
            onChange={(e) => update({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Penalty rate</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            20% (BINHS standard)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
