"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { borrowerService } from "@/services/borrower.service";
import {
  collateralService,
  collateralTypeService,
} from "@/services";
import { getShareCapitalBalance } from "@/utils/share-capital";
import { formatCurrency } from "@/utils/format";
import type { Borrower, Collateral, CollateralType } from "@/types";

interface Props {
  initial?: Collateral;
  mode: "create" | "edit";
}

export function CollateralForm({ initial, mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetBorrowerId = searchParams.get("borrower_id");

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [types, setTypes] = useState<CollateralType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [borrowerId, setBorrowerId] = useState<number | null>(
    initial?.borrower_id ??
      (presetBorrowerId ? Number(presetBorrowerId) : null),
  );
  const [borrowerOpen, setBorrowerOpen] = useState(false);
  const [typeId, setTypeId] = useState<number | null>(
    initial?.collateral_type_id ?? null,
  );
  const [detailValue, setDetailValue] = useState(initial?.detail_value ?? "");
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount ?? 0) : "",
  );
  const [scBalance, setScBalance] = useState<number | null>(null);
  const [scBalanceLoading, setScBalanceLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([borrowerService.list(), collateralTypeService.list()])
      .then(([bRes, tRes]) => {
        if (cancelled) return;
        const borrowerList = Array.isArray(bRes)
          ? bRes
          : (bRes as { data?: Borrower[] }).data ?? [];
        setBorrowers(borrowerList as Borrower[]);
        setTypes(tRes.filter((t) => t.is_visible));
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load form data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBorrower = useMemo(
    () => borrowers.find((b) => b.id === borrowerId) ?? null,
    [borrowers, borrowerId],
  );

  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId) ?? null,
    [types, typeId],
  );

  const isShareCapital = selectedType?.source === "share_capital";

  // When share-capital type is selected and borrower is known, fetch the balance.
  useEffect(() => {
    if (!isShareCapital || !borrowerId) {
      setScBalance(null);
      return;
    }
    let cancelled = false;
    setScBalanceLoading(true);
    getShareCapitalBalance(borrowerId).then((bal) => {
      if (cancelled) return;
      setScBalance(bal);
      setAmount(String(bal));
      setScBalanceLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isShareCapital, borrowerId]);

  const numericAmount = Number(amount);
  const canSubmit =
    borrowerId !== null &&
    typeId !== null &&
    detailValue.trim().length > 0 &&
    !Number.isNaN(numericAmount) &&
    numericAmount > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !borrowerId || !typeId) return;
    setSubmitting(true);
    try {
      const payload = {
        borrower_id: borrowerId,
        collateral_type_id: typeId,
        detail_value: detailValue.trim(),
        amount: numericAmount,
      };
      if (mode === "create") {
        await collateralService.create(payload);
        toast.success("Collateral registered");
      } else if (initial) {
        await collateralService.update(initial.id, payload);
        toast.success("Collateral updated");
      }
      router.push("/collaterals");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Register New Collateral" : "Edit Collateral"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Borrower */}
        <div className="space-y-2">
          <Label>
            Member <span className="text-destructive">*</span>
          </Label>
          <Popover open={borrowerOpen} onOpenChange={setBorrowerOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={borrowerOpen}
                  disabled={mode === "edit"}
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30"
                />
              }
            >
              <span
                className={cn(
                  "truncate",
                  !selectedBorrower && "text-muted-foreground",
                )}
              >
                {selectedBorrower
                  ? selectedBorrower.full_name
                  : "Search member..."}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-(--anchor-width) p-0" align="start">
              <Command>
                <CommandInput placeholder="Type a name to search..." />
                <CommandList>
                  <CommandEmpty>No member found.</CommandEmpty>
                  <CommandGroup>
                    {borrowers.map((b) => (
                      <CommandItem
                        key={b.id}
                        value={`${b.full_name} ${b.borrower_code}`}
                        onSelect={() => {
                          setBorrowerId(b.id === borrowerId ? null : b.id);
                          setBorrowerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            borrowerId === b.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {b.full_name}{" "}
                        <span className="text-muted-foreground">
                          ({b.borrower_code})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">
              Member can&apos;t be changed after registration.
            </p>
          )}
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label>
            Collateral Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={typeId ? String(typeId) : ""}
            onValueChange={(v) => setTypeId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedType && (
          <>
            {/* Detail value */}
            <div className="space-y-2">
              <Label>
                {selectedType.detail_field_label}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                value={detailValue}
                onChange={(e) => setDetailValue(e.target.value)}
                placeholder={`Enter ${selectedType.detail_field_label.toLowerCase()}`}
              />
            </div>

            {/* Amount — manual or share-capital-derived */}
            <div className="space-y-2">
              <Label>
                {selectedType.amount_field_label}{" "}
                {!isShareCapital && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              {isShareCapital ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  {!borrowerId ? (
                    <p className="text-sm text-muted-foreground">
                      Pick a member to see their share capital balance.
                    </p>
                  ) : scBalanceLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading balance...
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Share Balance (auto-derived)
                      </p>
                      <p className="text-lg font-semibold text-brand-orange tabular-nums">
                        {formatCurrency(scBalance ?? 0)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" render={<Link href="/collaterals" />}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Register Collateral" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
