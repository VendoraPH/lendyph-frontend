"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useApiResource } from "@/hooks";
import { notifySuccess } from "@/lib/notify";
import { RouteGuard, TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { savingsProductService } from "@/services/savings-product.service";
import type { SavingsProduct } from "@/types/savings";
import { ConfirmActionDialog } from "../_components/confirm-action-dialog";
import { ProductFormDialog } from "./_components/product-form-dialog";
import { ProductHistorySheet } from "./_components/product-history-sheet";
import { ProductTable, type ProductAction } from "./_components/product-table";
import { ProductFilters, type ProductStatusFilter } from "./_components/product-filters";
import { productToForm } from "./_lib/product-form";

const ENDPOINTS = [
  "GET /savings/products",
  "POST /savings/products",
  "PUT /savings/products/{id}",
  "PATCH /savings/products/{id}/status",
  "DELETE /savings/products/{id}",
];

function SavingsProductsContent() {
  const [status, setStatus] = useState<ProductStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<{ action: ProductAction; product: SavingsProduct } | null>(null);

  const fetcher = useCallback(
    () =>
      savingsProductService.list({
        page,
        per_page: perPage,
        ...(search ? { search } : {}),
        ...(status === "all" ? {} : { status }),
      }),
    [page, perPage, search, status],
  );
  const resource = useApiResource(fetcher);
  const { refetch } = resource;

  const editing = target?.action === "edit" ? target.product : null;
  const editForm = useMemo(() => (editing ? productToForm(editing) : undefined), [editing]);
  const close = () => setTarget(null);
  const isActive = target?.product.status === "active";

  const done = (message: string) => {
    notifySuccess(message);
    refetch();
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Savings products"
        description="The savings products members can open accounts on, with their balances, interest and rules."
        actions={
          <Button
            onClick={() => setCreating(true)}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add product
          </Button>
        }
      />

      <ProductFilters
        status={status}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        onSearch={(term) => {
          setSearch(term);
          setPage(1);
        }}
        stats={resource.data?.meta.stats}
      />

      <DataState
        resource={resource}
        summary="Your savings products, with their minimum balances, interest rate and status."
        endpoints={ENDPOINTS}
      >
        {(res) => (
          <div className="space-y-4">
            <ProductTable products={res.data} onAction={(action, product) => setTarget({ action, product })} />
            <TablePagination
              page={page}
              perPage={perPage}
              total={res.meta.total}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </DataState>

      <ProductFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Add savings product"
        description="Members can open accounts on an active product."
        onSubmit={async (payload) => {
          await savingsProductService.create(payload);
          done("Savings product created");
        }}
      />

      <ProductFormDialog
        open={editing !== null}
        onOpenChange={(v) => !v && close()}
        initialData={editForm}
        title="Edit savings product"
        description="Changes apply to new transactions. Existing accounts keep their balances."
        onSubmit={async (payload) => {
          if (!editing) return;
          await savingsProductService.update(editing.id, payload);
          done("Savings product updated");
        }}
      />

      <ConfirmActionDialog
        open={target?.action === "status"}
        onOpenChange={(v) => !v && close()}
        title={isActive ? "Deactivate product" : "Activate product"}
        description={
          isActive
            ? `New accounts can no longer be opened on "${target?.product.name}". Existing accounts are not affected.`
            : `Members will be able to open accounts on "${target?.product.name}".`
        }
        confirmLabel={isActive ? "Deactivate" : "Activate"}
        destructive={isActive}
        errorFallback="We couldn't change this product's status. Please try again."
        onConfirm={async () => {
          if (!target) return;
          await savingsProductService.setStatus(target.product.id, isActive ? "inactive" : "active");
          done(isActive ? "Product deactivated" : "Product activated");
        }}
      />

      <ConfirmActionDialog
        open={target?.action === "delete"}
        onOpenChange={(v) => !v && close()}
        title="Delete product"
        description={`"${target?.product.name}" has no accounts and will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        errorFallback="We couldn't delete this product. Please try again."
        onConfirm={async () => {
          if (!target) return;
          await savingsProductService.remove(target.product.id);
          done("Savings product deleted");
        }}
      />

      <ProductHistorySheet
        product={target?.action === "history" ? target.product : null}
        onOpenChange={(v) => !v && close()}
      />
    </div>
  );
}

export default function SavingsProductsPage() {
  return (
    <RouteGuard permission="savings_products:manage" pageName="Savings Products">
      <SavingsProductsContent />
    </RouteGuard>
  );
}
