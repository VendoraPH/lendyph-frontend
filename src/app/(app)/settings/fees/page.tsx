"use client";

import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Receipt, Plus, Pencil, Trash2, Loader2, Search, Percent, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { feeService, loanProductService } from "@/services";
import type { Fee, FeeType, FeeConditions, CreateFeeData, LoanProduct } from "@/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

// ---------------------------------------------------------------------------
// Fee Form Dialog
// ---------------------------------------------------------------------------

interface FeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee?: Fee | null;
  products: LoanProduct[];
  onSave: () => void;
}

function FeeFormDialog({ open, onOpenChange, fee, products, onSave }: FeeFormDialogProps) {
  const isEdit = !!fee;
  const [name, setName] = useState("");
  const [type, setType] = useState<FeeType>("fixed");
  const [value, setValue] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [conditions, setConditions] = useState<FeeConditions>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fee) {
      setName(fee.name);
      setType(fee.type);
      setValue(String(fee.value));
      setSelectedProducts(fee.applicable_product_ids ?? []);
      setConditions(fee.conditions ?? {});
    } else {
      setName("");
      setType("fixed");
      setValue("");
      setSelectedProducts([]);
      setConditions({});
    }
  }, [fee, open]);

  function toggleProduct(id: number) {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function updateCondition(key: keyof FeeConditions, raw: string) {
    setConditions((prev) => {
      const next = { ...prev };
      if (raw === "") {
        delete next[key];
      } else {
        next[key] = Number(raw);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericValue = Number(value);
    if (!name.trim() || !Number.isFinite(numericValue)) return;

    const payload: CreateFeeData = {
      name: name.trim(),
      type,
      value: numericValue,
      applicable_product_ids: selectedProducts,
      ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
    };

    setSaving(true);
    try {
      if (isEdit && fee) {
        await feeService.update(fee.id, payload);
        toast.success("Fee updated");
      } else {
        await feeService.create(payload);
        toast.success("Fee created");
      }
      onOpenChange(false);
      onSave();
    } catch {
      toast.error(isEdit ? "We couldn't update the fee. Please try again." : "We couldn't create the fee. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Fee" : "Add New Fee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this reusable fee and its applicability."
              : "Create a reusable fee that can apply to one or more loan products."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee-name">
                Fee Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fee-name"
                placeholder="e.g. Notarial Fee"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as FeeType)}>
                <SelectTrigger id="fee-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee-value">
              {type === "fixed" ? "Amount (₱)" : "Rate (%)"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fee-value"
              type="number"
              step={type === "fixed" ? "1" : "0.01"}
              placeholder={type === "fixed" ? "500" : "2"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Applicable Loan Products</Label>
            <p className="text-xs text-muted-foreground">
              Select which loan products this fee applies to. Leave empty to apply to all.
            </p>
            <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1.5">
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No loan products defined yet.
                </p>
              ) : (
                products.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>{p.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conditions (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Leave blank to always apply. Fill only the conditions you need.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cond-term-gt" className="text-xs">Term days &gt;</Label>
                <Input
                  id="cond-term-gt"
                  type="number"
                  value={conditions.term_days_gt ?? ""}
                  onChange={(e) => updateCondition("term_days_gt", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cond-term-lt" className="text-xs">Term days &lt;</Label>
                <Input
                  id="cond-term-lt"
                  type="number"
                  value={conditions.term_days_lt ?? ""}
                  onChange={(e) => updateCondition("term_days_lt", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cond-term-eq" className="text-xs">Term days =</Label>
                <Input
                  id="cond-term-eq"
                  type="number"
                  value={conditions.term_days_eq ?? ""}
                  onChange={(e) => updateCondition("term_days_eq", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cond-amt-gt" className="text-xs">Loan amount &gt;</Label>
                <Input
                  id="cond-amt-gt"
                  type="number"
                  value={conditions.loan_amount_gt ?? ""}
                  onChange={(e) => updateCondition("loan_amount_gt", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cond-amt-lt" className="text-xs">Loan amount &lt;</Label>
                <Input
                  id="cond-amt-lt"
                  type="number"
                  value={conditions.loan_amount_lt ?? ""}
                  onChange={(e) => updateCondition("loan_amount_lt", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cond-amt-eq" className="text-xs">Loan amount =</Label>
                <Input
                  id="cond-amt-eq"
                  type="number"
                  value={conditions.loan_amount_eq ?? ""}
                  onChange={(e) => updateCondition("loan_amount_eq", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || value === ""}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Update Fee" : "Create Fee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog
// ---------------------------------------------------------------------------

interface DeleteFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: Fee | null;
  onConfirm: () => void;
}

function DeleteFeeDialog({ open, onOpenChange, fee, onConfirm }: DeleteFeeDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!fee) return;
    setDeleting(true);
    try {
      await feeService.delete(fee.id);
      toast.success("Fee deleted");
      onOpenChange(false);
      onConfirm();
    } catch {
      toast.error("We couldn't delete the fee. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Fee</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{fee?.name}</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function formatFeeValue(fee: Fee): string {
  if (fee.type === "percentage") return `${fee.value}%`;
  return formatCurrency(fee.value);
}

function formatConditions(c: FeeConditions | undefined): string {
  if (!c) return "—";
  const parts: string[] = [];
  if (c.term_days_gt != null) parts.push(`term > ${c.term_days_gt}d`);
  if (c.term_days_lt != null) parts.push(`term < ${c.term_days_lt}d`);
  if (c.term_days_eq != null) parts.push(`term = ${c.term_days_eq}d`);
  if (c.loan_amount_gt != null) parts.push(`amount > ₱${c.loan_amount_gt.toLocaleString()}`);
  if (c.loan_amount_lt != null) parts.push(`amount < ₱${c.loan_amount_lt.toLocaleString()}`);
  if (c.loan_amount_eq != null) parts.push(`amount = ₱${c.loan_amount_eq.toLocaleString()}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editFee, setEditFee] = useState<Fee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Fee | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [feesRes, productsRes] = await Promise.all([
        feeService.list(),
        loanProductService.list(),
      ]);
      setFees(Array.isArray(feesRes) ? feesRes : (feesRes as { data?: Fee[] })?.data ?? []);
      setProducts(Array.isArray(productsRes) ? productsRes : (productsRes as { data?: LoanProduct[] })?.data ?? []);
    } catch {
      toast.error("We couldn't load the fees. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  const filtered = fees.filter((f) => {
    if (!search.trim()) return true;
    return f.name.toLowerCase().includes(search.toLowerCase());
  });

  const fixedCount = fees.filter((f) => f.type === "fixed").length;
  const percentageCount = fees.filter((f) => f.type === "percentage").length;

  function handleAdd() {
    setEditFee(null);
    setFormOpen(true);
  }

  function handleEdit(fee: Fee) {
    setEditFee(fee);
    setFormOpen(true);
  }

  function handleDelete(fee: Fee) {
    setDeleteTarget(fee);
    setDeleteOpen(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <RouteGuard permission="settings:view" pageName="Fees Settings">
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fees</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable fees that apply across loan products
            </p>
          </div>
          <Button
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={handleAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Fee
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fees.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fixed</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fixedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Percentage</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{percentageCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search fees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Applicable Products</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fee) => {
                    const productNames =
                      (fee.applicable_product_ids ?? [])
                        .map((id) => productNameById.get(id))
                        .filter(Boolean) as string[];
                    return (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              fee.type === "fixed"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                            )}
                          >
                            {fee.type === "fixed" ? "Fixed" : "Percentage"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatFeeValue(fee)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {productNames.length === 0
                            ? "All products"
                            : productNames.length <= 2
                              ? productNames.join(", ")
                              : `${productNames.slice(0, 2).join(", ")} +${productNames.length - 2}`}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatConditions(fee.conditions)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleEdit(fee)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                              onClick={() => handleDelete(fee)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {search ? "No fees match your search." : "No fees defined yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <FeeFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          fee={editFee}
          products={products}
          onSave={fetchData}
        />

        <DeleteFeeDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          fee={deleteTarget}
          onConfirm={fetchData}
        />
      </div>
    </RouteGuard>
  );
}
