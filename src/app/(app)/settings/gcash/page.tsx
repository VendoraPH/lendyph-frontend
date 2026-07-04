"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteGuard } from "@/components/common";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashTier, GCashTierInput } from "@/types";

type Row = GCashTierInput & { tempId: string };

function makeRow(seed?: Partial<GCashTierInput>): Row {
  return {
    tempId: Math.random().toString(36).slice(2),
    min_amount: seed?.min_amount ?? 0,
    max_amount: seed?.max_amount ?? 0,
    cash_in_rate: seed?.cash_in_rate ?? 0,
    cash_out_rate: seed?.cash_out_rate ?? 0,
    display_order: seed?.display_order ?? 0,
  };
}

function validate(rows: Row[]): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.display_order - b.display_order);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!(r.min_amount > 0)) return `Row ${i + 1}: Min amount must be > 0.`;
    if (!(r.max_amount > r.min_amount))
      return `Row ${i + 1}: Max amount must be greater than Min.`;
    if (r.cash_in_rate < 0 || r.cash_out_rate < 0)
      return `Row ${i + 1}: Rates cannot be negative.`;
    if (i > 0 && sorted[i - 1].max_amount >= r.min_amount)
      return `Row ${i + 1}: overlaps with the previous tier.`;
  }
  return null;
}

export default function GCashSettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await gcashService.listTiers();
        if (cancelled) return;
        const safe: GCashTier[] = Array.isArray(list) ? [...list] : [];
        safe.sort((a, b) => a.display_order - b.display_order);
        setRows(safe.map((t) => makeRow(t)));
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (tempId: string, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)),
    );

  const addRow = () => {
    const nextOrder =
      rows.length === 0
        ? 1
        : Math.max(...rows.map((r) => r.display_order)) + 1;
    setRows((prev) => [...prev, makeRow({ display_order: nextOrder })]);
  };

  const removeRow = (tempId: string) =>
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));

  const handleSave = async () => {
    const error = validate(rows);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const payload: GCashTierInput[] = rows
        .map((r): GCashTierInput => ({
          min_amount: r.min_amount,
          max_amount: r.max_amount,
          cash_in_rate: r.cash_in_rate,
          cash_out_rate: r.cash_out_rate,
          display_order: r.display_order,
        }))
        .sort((a, b) => a.display_order - b.display_order);
      const saved = await gcashService.upsertTiers(payload);
      const safe = Array.isArray(saved) ? [...saved] : [];
      safe.sort((a, b) => a.display_order - b.display_order);
      setRows(safe.map((t) => makeRow(t)));
      toast.success("GCash tiers saved.");
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard permission="gcash:settings" pageName="GCash Settings">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">GCash Tiered Charges</h1>
          <p className="text-sm text-muted-foreground">
            Charges are computed at transaction time based on the amount tier.
            Existing transactions are not affected when these change.
          </p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Order</TableHead>
                <TableHead>Min Amount</TableHead>
                <TableHead>Max Amount</TableHead>
                <TableHead>Cash In Rate (₱)</TableHead>
                <TableHead>Cash Out Rate (₱)</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="inline-block h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No tiers configured. Click + to add one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.tempId}>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.display_order}
                        min={1}
                        onChange={(e) =>
                          update(r.tempId, {
                            display_order: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.min_amount}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            min_amount: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.max_amount}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            max_amount: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.cash_in_rate}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            cash_in_rate: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.cash_out_rate}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          update(r.tempId, {
                            cash_out_rate: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.tempId)}
                        aria-label="Remove tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tier
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving…" : "Save Tiers"}
          </Button>
        </div>
      </div>
    </RouteGuard>
  );
}
