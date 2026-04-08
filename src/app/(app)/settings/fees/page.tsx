"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { feeService } from "@/services/fee.service";
import { loanProductService } from "@/services/loan-product.service";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Receipt,
  DollarSign,
  Percent,
} from "lucide-react";
import type { Fee, FeeType, FeeConditions, CreateFeeData } from "@/types";
import type { LoanProduct } from "@/types/loan";

// ── Helpers ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

function formatFeeValue(fee: Fee): string {
  if (fee.type === "fixed") return formatCurrency(fee.value);
  return `${fee.value}%`;
}

function formatConditions(fee: Fee): string {
  const parts: string[] = [];
  const c = fee.conditions;
  if (!c) return "\u2014";
  if (c.term_days_gt) parts.push(`Term > ${c.term_days_gt}d`);
  if (c.term_days_lt) parts.push(`Term < ${c.term_days_lt}d`);
  if (c.term_days_eq) parts.push(`Term = ${c.term_days_eq}d`);
  if (c.loan_amount_gt) parts.push(`Amount > ${formatCurrency(c.loan_amount_gt)}`);
  if (c.loan_amount_lt) parts.push(`Amount < ${formatCurrency(c.loan_amount_lt)}`);
  if (c.loan_amount_eq) parts.push(`Amount = ${formatCurrency(c.loan_amount_eq)}`);
  return parts.length > 0 ? parts.join(", ") : "\u2014";
}

function formatAppliesTo(fee: Fee, products: LoanProduct[]): string {
  if (
    !fee.applicable_product_ids ||
    fee.applicable_product_ids.length === 0 ||
    fee.applicable_product_ids.length === products.length
  ) {
    return `All Products (${products.length})`;
  }
  const names = fee.applicable_product_ids
    .map((id) => products.find((p) => p.id === id)?.name)
    .filter(Boolean);
  return names.join(", ");
}

const typeBadge: Record<FeeType, string> = {
  fixed: "bg-green-100 text-green-700 border-green-200",
  percentage: "bg-blue-100 text-blue-700 border-blue-200",
};

// ── Form Types ──

interface FeeForm {
  name: string;
  type: FeeType;
  value: string;
  applicable_product_ids: number[];
  term_days_gt: string;
  term_days_lt: string;
  term_days_eq: string;
  loan_amount_gt: string;
  loan_amount_lt: string;
  loan_amount_eq: string;
}

const EMPTY_FORM: FeeForm = {
  name: "",
  type: "fixed",
  value: "",
  applicable_product_ids: [],
  term_days_gt: "",
  term_days_lt: "",
  term_days_eq: "",
  loan_amount_gt: "",
  loan_amount_lt: "",
  loan_amount_eq: "",
};

function feeToForm(fee: Fee): FeeForm {
  const c = fee.conditions ?? {};
  return {
    name: fee.name,
    type: fee.type,
    value: String(fee.value),
    applicable_product_ids: fee.applicable_product_ids ?? [],
    term_days_gt: c.term_days_gt ? String(c.term_days_gt) : "",
    term_days_lt: c.term_days_lt ? String(c.term_days_lt) : "",
    term_days_eq: c.term_days_eq ? String(c.term_days_eq) : "",
    loan_amount_gt: c.loan_amount_gt ? String(c.loan_amount_gt) : "",
    loan_amount_lt: c.loan_amount_lt ? String(c.loan_amount_lt) : "",
    loan_amount_eq: c.loan_amount_eq ? String(c.loan_amount_eq) : "",
  };
}

function formToApiPayload(form: FeeForm): CreateFeeData {
  const conditions: FeeConditions = {};
  if (form.term_days_gt) conditions.term_days_gt = Number(form.term_days_gt);
  if (form.term_days_lt) conditions.term_days_lt = Number(form.term_days_lt);
  if (form.term_days_eq) conditions.term_days_eq = Number(form.term_days_eq);
  if (form.loan_amount_gt) conditions.loan_amount_gt = Number(form.loan_amount_gt);
  if (form.loan_amount_lt) conditions.loan_amount_lt = Number(form.loan_amount_lt);
  if (form.loan_amount_eq) conditions.loan_amount_eq = Number(form.loan_amount_eq);

  return {
    name: form.name,
    type: form.type,
    value: Number(form.value),
    applicable_product_ids: form.applicable_product_ids,
    conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
  };
}

// ── Fee Form Dialog ──

function FeeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: FeeForm) => void;
  initialData?: FeeForm;
  title: string;
  description: string;
  products: LoanProduct[];
}) {
  const [form, setForm] = useState<FeeForm>(initialData ?? EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(initialData ?? EMPTY_FORM);
    }
  }, [open, initialData]);

  const update = (field: keyof FeeForm, value: string | number[] | FeeType) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleProduct = (productId: number) => {
    setForm((prev) => {
      const ids = prev.applicable_product_ids.includes(productId)
        ? prev.applicable_product_ids.filter((id) => id !== productId)
        : [...prev.applicable_product_ids, productId];
      return { ...prev, applicable_product_ids: ids };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Fee name is required");
      return;
    }
    if (!form.value) {
      toast.error("Fee value is required");
      return;
    }
    if (form.applicable_product_ids.length === 0) {
      toast.error("Select at least one loan product");
      return;
    }
    onSubmit(form);
    if (!initialData) setForm(EMPTY_FORM);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Basic Info
            </h3>
            <div className="space-y-2">
              <Label htmlFor="fee-name">Fee Name *</Label>
              <Input
                id="fee-name"
                placeholder="e.g. Processing Fee"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => update("type", v as FeeType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="formula" disabled>
                      Formula (Coming Soon)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee-value">
                  {form.type === "fixed" ? "Amount (PHP)" : "Rate (%)"} *
                </Label>
                <Input
                  id="fee-value"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={form.type === "fixed" ? "500" : "2"}
                  value={form.value}
                  onChange={(e) => update("value", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Applicable Loan Products */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Applicable Loan Products
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No loan products available. Create one first.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={form.applicable_product_ids.includes(product.id)}
                      onCheckedChange={() => toggleProduct(product.id)}
                    />
                    <span className="text-sm">{product.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Conditions */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Additional Conditions
              <span className="ml-2 text-xs font-normal normal-case tracking-normal text-muted-foreground">
                (optional)
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Term Days */}
              <div className="space-y-3 border rounded-md p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Term Days
                </p>
                <div className="space-y-2">
                  <Label htmlFor="term-gt" className="text-xs">Greater than</Label>
                  <Input
                    id="term-gt"
                    type="number"
                    min={0}
                    placeholder="e.g. 90"
                    value={form.term_days_gt}
                    onChange={(e) => update("term_days_gt", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term-lt" className="text-xs">Less than</Label>
                  <Input
                    id="term-lt"
                    type="number"
                    min={0}
                    placeholder="e.g. 365"
                    value={form.term_days_lt}
                    onChange={(e) => update("term_days_lt", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term-eq" className="text-xs">Equal to</Label>
                  <Input
                    id="term-eq"
                    type="number"
                    min={0}
                    placeholder="e.g. 180"
                    value={form.term_days_eq}
                    onChange={(e) => update("term_days_eq", e.target.value)}
                  />
                </div>
              </div>

              {/* Loan Amount */}
              <div className="space-y-3 border rounded-md p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Loan Amount
                </p>
                <div className="space-y-2">
                  <Label htmlFor="amount-gt" className="text-xs">Greater than</Label>
                  <Input
                    id="amount-gt"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 50000"
                    value={form.loan_amount_gt}
                    onChange={(e) => update("loan_amount_gt", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount-lt" className="text-xs">Less than</Label>
                  <Input
                    id="amount-lt"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 200000"
                    value={form.loan_amount_lt}
                    onChange={(e) => update("loan_amount_lt", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount-eq" className="text-xs">Equal to</Label>
                  <Input
                    id="amount-eq"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 100000"
                    value={form.loan_amount_eq}
                    onChange={(e) => update("loan_amount_eq", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tiered Charges (disabled) */}
          <div className="space-y-4 opacity-50">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              Tiered Charges
              <Badge variant="outline" className="text-xs font-normal normal-case">
                Coming Soon
              </Badge>
            </h3>
            <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">
              Tiered fee structures based on loan amount or term will be available in a future update.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {initialData ? "Save Changes" : "Create Fee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Fee Dialog ──

function DeleteFeeDialog({
  fee,
  open,
  onOpenChange,
  onConfirm,
}: {
  fee: Fee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Fee
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{fee.name}&quot;?
            This action cannot be undone. Existing loans with this fee will
            not be affected.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Fee Actions Cell ──

function FeeActionsCell({
  fee,
  onEdit,
  onDelete,
  products,
}: {
  fee: Fee;
  onEdit: (form: FeeForm) => void;
  onDelete: () => void;
  products: LoanProduct[];
}) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenDialog("edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeeFormDialog
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSubmit={onEdit}
        initialData={feeToForm(fee)}
        title="Edit Fee"
        description={`Update the configuration for ${fee.name}.`}
        products={products}
      />
      <DeleteFeeDialog
        fee={fee}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onDelete}
      />
    </>
  );
}

// ── Main Page ──

export default function FeeManagementPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [feesResult, productsResult] = await Promise.allSettled([
        feeService.list(),
        loanProductService.list(),
      ]);

      if (feesResult.status === "fulfilled") {
        const res = feesResult.value;
        setFees(Array.isArray(res) ? res : (res as unknown as { data: Fee[] }).data ?? []);
      } else {
        toast.error("Failed to load fees");
      }

      if (productsResult.status === "fulfilled") {
        const res = productsResult.value;
        setProducts(
          Array.isArray(res) ? res : (res as unknown as { data: LoanProduct[] }).data ?? []
        );
      } else {
        toast.error("Failed to load loan products");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fixedCount = fees.filter((f) => f.type === "fixed").length;
  const percentageCount = fees.filter((f) => f.type === "percentage").length;

  const handleAdd = async (form: FeeForm) => {
    try {
      const payload = formToApiPayload(form);
      await feeService.create(payload);
      toast.success("Fee created");
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const firstError = Object.values(apiErrors)[0]?.[0];
        toast.error(firstError || "Validation failed");
      } else {
        toast.error(err?.response?.data?.message || "Failed to create fee");
      }
    }
  };

  const handleEdit = async (id: number, form: FeeForm) => {
    try {
      const payload = formToApiPayload(form);
      await feeService.update(id, payload);
      toast.success("Fee updated");
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to update fee");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await feeService.delete(id);
      toast.success("Fee deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete fee");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-muted-foreground">
            Configure fees applied to loan products
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Fee
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4" />
                <span className="text-sm font-medium">Total Fees</span>
              </div>
              <span className="text-2xl font-bold">{fees.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Fixed</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {fixedCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600">
                <Percent className="h-4 w-4" />
                <span className="text-sm font-medium">Percentage</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {percentageCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-brand-orange" />
        </div>
      ) : (
      <>
      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        <p className="text-sm font-medium text-muted-foreground">
          All Fees ({fees.length})
        </p>
        {fees.map((fee) => (
          <Card key={fee.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{fee.name}</p>
                    <Badge
                      variant="outline"
                      className={typeBadge[fee.type]}
                    >
                      {fee.type}
                    </Badge>
                  </div>
                </div>
                <FeeActionsCell
                  fee={fee}
                  onEdit={(form) => handleEdit(fee.id, form)}
                  onDelete={() => handleDelete(fee.id)}
                  products={products}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="font-medium">{formatFeeValue(fee)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Applies To</p>
                  <p className="text-xs">{formatAppliesTo(fee, products)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Conditions</p>
                  <p className="text-xs">{formatConditions(fee)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {fees.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No fees found. Add one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            All Fees ({fees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell>
                      <p className="font-medium">{fee.name}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={typeBadge[fee.type]}
                      >
                        {fee.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap">
                      {formatFeeValue(fee)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAppliesTo(fee, products)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatConditions(fee)}
                    </TableCell>
                    <TableCell>
                      <FeeActionsCell
                        fee={fee}
                        onEdit={(form) => handleEdit(fee.id, form)}
                        onDelete={() => handleDelete(fee.id)}
                        products={products}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {fees.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No fees found. Add one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      </>
      )}

      {/* Add Fee Dialog */}
      <FeeFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
        title="Add Fee"
        description="Create a new fee that will be applied to loan products."
        products={products}
      />
    </div>
  );
}
