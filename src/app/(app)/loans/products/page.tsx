"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { loanProductService } from "@/services/loan-product.service";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogClose,
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
  ToggleLeft,
  ToggleRight,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/constants";
import type { LoanProduct } from "@/types/loan";

// ── Helpers ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

// Helper to read API fields (API uses interest_method/frequency/term, our type has interest_type/payment_frequency/min_term)
function getProductField(product: LoanProduct, field: string): string {
  const p = product as unknown as Record<string, unknown>;
  switch (field) {
    case "interest_method": return String(p.interest_method ?? p.interest_type ?? "straight");
    case "frequency": return String(p.frequency ?? p.payment_frequency ?? "monthly");
    case "term": return String(p.term ?? p.min_term ?? "");
    case "grace_period_days": return String(p.grace_period_days ?? p.grace_period ?? "0");
    default: return String(p[field] ?? "");
  }
}

const INTEREST_METHOD_LABELS: Record<string, string> = {
  straight: "Straight",
  fixed: "Fixed",
  diminishing: "Diminishing",
  upon_maturity: "Upon Maturity",
};

const statusBadge = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
};

// ── Form Types ──

interface ProductForm {
  name: string;
  description: string;
  min_amount: string;
  max_amount: string;
  term: string;
  frequency: string;
  interest_rate: string;
  interest_method: string;
  processing_fee: string;
  service_fee: string;
  penalty_rate: string;
  grace_period_days: string;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  min_amount: "",
  max_amount: "",
  term: "",
  frequency: "monthly",
  interest_rate: "",
  interest_method: "straight",
  processing_fee: "",
  service_fee: "",
  penalty_rate: "",
  grace_period_days: "",
};

function productToForm(p: LoanProduct): ProductForm {
  // Map API response fields to form fields
  const apiProduct = p as unknown as Record<string, unknown>;
  return {
    name: p.name,
    description: p.description ?? "",
    min_amount: String(apiProduct.min_amount ?? p.min_amount ?? ""),
    max_amount: String(apiProduct.max_amount ?? p.max_amount ?? ""),
    term: String(apiProduct.term ?? p.min_term ?? ""),
    frequency: String(apiProduct.frequency ?? p.payment_frequency ?? "monthly"),
    interest_rate: String(p.interest_rate),
    interest_method: String(apiProduct.interest_method ?? p.interest_type ?? "straight"),
    processing_fee: String(apiProduct.processing_fee ?? p.processing_fee ?? ""),
    service_fee: String(apiProduct.service_fee ?? p.service_fee ?? ""),
    penalty_rate: String(apiProduct.penalty_rate ?? p.penalty_rate ?? ""),
    grace_period_days: String(apiProduct.grace_period_days ?? p.grace_period ?? ""),
  };
}

function formToApiPayload(form: ProductForm) {
  return {
    name: form.name,
    interest_rate: Number(form.interest_rate),
    interest_method: form.interest_method as "straight" | "diminishing" | "upon_maturity",
    term: Number(form.term),
    frequency: form.frequency as "daily" | "weekly" | "semi_monthly" | "monthly",
    processing_fee: form.processing_fee ? Number(form.processing_fee) : undefined,
    service_fee: form.service_fee ? Number(form.service_fee) : undefined,
    penalty_rate: form.penalty_rate ? Number(form.penalty_rate) : undefined,
    grace_period_days: form.grace_period_days ? Number(form.grace_period_days) : undefined,
    min_amount: form.min_amount ? Number(form.min_amount) : undefined,
    max_amount: form.max_amount ? Number(form.max_amount) : undefined,
  };
}

// ── Product Form Dialog ──

function ProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: ProductForm) => void;
  initialData?: ProductForm;
  title: string;
  description: string;
}) {
  const [form, setForm] = useState<ProductForm>(initialData ?? EMPTY_FORM);

  const update = (field: keyof ProductForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
              <Label htmlFor="product-name">Product Name *</Label>
              <Input
                id="product-name"
                placeholder="e.g. Salary Loan"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                placeholder="Brief description of this loan product"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
          </div>

          {/* Amount & Term */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Amount & Term
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-amount">Minimum Amount (PHP) *</Label>
                <Input
                  id="min-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="5,000"
                  value={form.min_amount}
                  onChange={(e) => update("min_amount", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-amount">Maximum Amount (PHP) *</Label>
                <Input
                  id="max-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="50,000"
                  value={form.max_amount}
                  onChange={(e) => update("max_amount", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="term">Term (months) <span className="text-red-500">*</span></Label>
                <Input
                  id="term"
                  type="number"
                  min={1}
                  placeholder="12"
                  value={form.term}
                  onChange={(e) => update("term", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Frequency *</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => update("frequency", v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select frequency" />
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
            </div>
          </div>

          {/* Interest */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Interest
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interest-rate">Interest Rate (%) *</Label>
                <Input
                  id="interest-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="3"
                  value={form.interest_rate}
                  onChange={(e) => update("interest_rate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Interest Method *</Label>
                <Select
                  value={form.interest_method}
                  onValueChange={(v) => update("interest_method", v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Fees & Penalties */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Fees & Penalties
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="processing-fee">Processing Fee (%)</Label>
                <Input
                  id="processing-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="2"
                  value={form.processing_fee}
                  onChange={(e) => update("processing_fee", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-fee">Service Fee (%)</Label>
                <Input
                  id="service-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="1"
                  value={form.service_fee}
                  onChange={(e) => update("service_fee", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="penalty-rate">Penalty Rate (% per day)</Label>
                <Input
                  id="penalty-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.5"
                  value={form.penalty_rate}
                  onChange={(e) => update("penalty_rate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grace-period">Grace Period (days)</Label>
                <Input
                  id="grace-period"
                  type="number"
                  min={0}
                  placeholder="3"
                  value={form.grace_period_days}
                  onChange={(e) => update("grace_period_days", e.target.value)}
                />
              </div>
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
              {initialData ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle Status Dialog ──

function ToggleStatusDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: {
  product: LoanProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isActive = product.is_active;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-orange" />
            {isActive ? "Deactivate" : "Activate"} Product
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Are you sure you want to deactivate "${product.name}"? It will no longer appear as an option during loan applications.`
              : `Are you sure you want to activate "${product.name}"? It will become available for loan applications.`}
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
            className={
              isActive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-green-600 text-white hover:bg-green-700"
            }
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Product Dialog ──

function DeleteProductDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: {
  product: LoanProduct;
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
            Delete Loan Product
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{product.name}&quot;?
            This action cannot be undone. Existing loans using this product will
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

// ── Product Actions Cell ──

function ProductActionsCell({
  product,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  product: LoanProduct;
  onEdit: (form: ProductForm) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
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
          <DropdownMenuItem onClick={() => setOpenDialog("status")}>
            {product.is_active ? (
              <ToggleLeft className="mr-2 h-4 w-4" />
            ) : (
              <ToggleRight className="mr-2 h-4 w-4" />
            )}
            {product.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductFormDialog
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSubmit={onEdit}
        initialData={productToForm(product)}
        title="Edit Loan Product"
        description={`Update the configuration for ${product.name}.`}
      />
      <ToggleStatusDialog
        product={product}
        open={openDialog === "status"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onToggleStatus}
      />
      <DeleteProductDialog
        product={product}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onDelete}
      />
    </>
  );
}

// ── Main Page ──

export default function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loanProductService.list();
      setProducts(Array.isArray(res) ? res : (res as unknown as { data: LoanProduct[] }).data ?? []);
    } catch {
      toast.error("Failed to load loan products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const activeCount = products.filter((p) => p.is_active).length;
  const inactiveCount = products.filter((p) => !p.is_active).length;

  const handleAdd = async (form: ProductForm) => {
    try {
      const payload = formToApiPayload(form);
      await loanProductService.create(payload);
      toast.success("Loan product created");
      fetchProducts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const firstError = Object.values(apiErrors)[0]?.[0];
        toast.error(firstError || "Validation failed");
      } else {
        toast.error(err?.response?.data?.message || "Failed to create loan product");
      }
    }
  };

  const handleEdit = async (id: number, form: ProductForm) => {
    try {
      const payload = formToApiPayload(form);
      await loanProductService.update(id, payload);
      toast.success("Loan product updated");
      fetchProducts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to update loan product");
    }
  };

  const handleToggleStatus = async (id: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    try {
      await loanProductService.update(id, { is_active: !product.is_active } as unknown as Parameters<typeof loanProductService.update>[1]);
      toast.success(product.is_active ? "Product deactivated" : "Product activated");
      fetchProducts();
    } catch {
      toast.error("Failed to update product status");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await loanProductService.delete(id);
      toast.success("Loan product deleted");
      fetchProducts();
    } catch {
      toast.error("Failed to delete loan product");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Products</h1>
          <p className="text-muted-foreground">
            Configure loan products and terms for loan applications
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Loan Product
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm font-medium">Total Products</span>
              </div>
              <span className="text-2xl font-bold">{products.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Active</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {activeCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Inactive</span>
              </div>
              <span className="text-2xl font-bold text-red-600">
                {inactiveCount}
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
          All Products ({products.length})
        </p>
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{product.name}</p>
                    <Badge
                      variant="outline"
                      className={
                        product.is_active
                          ? statusBadge.active
                          : statusBadge.inactive
                      }
                    >
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {product.description}
                    </p>
                  )}
                </div>
                <ProductActionsCell
                  product={product}
                  onEdit={(form) => handleEdit(product.id, form)}
                  onToggleStatus={() => handleToggleStatus(product.id)}
                  onDelete={() => handleDelete(product.id)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Interest</p>
                  <p className="font-medium">
                    {product.interest_rate}%{" "}
                    <span className="text-muted-foreground font-normal">
                      {INTEREST_METHOD_LABELS[getProductField(product, "interest_method")]}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Frequency</p>
                  <p>{PAYMENT_FREQUENCY_LABELS[getProductField(product, "frequency")]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-xs">
                    {formatCurrency(product.min_amount)} – {formatCurrency(product.max_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Term</p>
                  <p>{getProductField(product, "term")} months</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fees</p>
                  <p className="text-xs">
                    Processing {product.processing_fee}% · Service {product.service_fee}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Penalty</p>
                  <p className="text-xs">
                    {product.penalty_rate}%/day · {getProductField(product, "grace_period_days")}d grace
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No loan products found. Add one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            All Products ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Amount Range</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">
                          {product.interest_rate}%
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {INTEREST_METHOD_LABELS[getProductField(product, "interest_method")]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {getProductField(product, "term")} months
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatCurrency(product.min_amount)} —{" "}
                      {formatCurrency(product.max_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {PAYMENT_FREQUENCY_LABELS[getProductField(product, "frequency")]}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        <span>Processing: {product.processing_fee}%</span>
                        <br />
                        <span>Service: {product.service_fee}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          product.is_active
                            ? statusBadge.active
                            : statusBadge.inactive
                        }
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ProductActionsCell
                        product={product}
                        onEdit={(form) => handleEdit(product.id, form)}
                        onToggleStatus={() => handleToggleStatus(product.id)}
                        onDelete={() => handleDelete(product.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No loan products found. Add one to get started.
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

      {/* Add Product Dialog */}
      <ProductFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
        title="Add Loan Product"
        description="Create a new loan product that staff can select during loan applications."
      />
    </div>
  );
}
