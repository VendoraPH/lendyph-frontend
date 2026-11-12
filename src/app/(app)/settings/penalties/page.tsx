"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard, PermissionButton } from "@/components/common";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { DataState } from "@/components/common/data-state";
import { Input } from "@/components/ui/input";
import { useApiResource, usePermission } from "@/hooks";
import { notifyError } from "@/lib/notify";
import { completeRows } from "@/lib/paginate";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { loanProductService, penaltyConfigService } from "@/services";
import type { PenaltyConfig } from "@/types/penalty";
import { DEACTIVATE_NOTE, configProductNames } from "./_lib/penalty-form";
import { PenaltyFormDialog } from "./_components/penalty-form-dialog";
import { PenaltyStatusDialog } from "./_components/penalty-status-dialog";
import { PenaltyTable } from "./_components/penalty-table";
import { PenaltyViewDialog } from "./_components/penalty-view-dialog";

// Module scope keeps the fetchers stable for useApiResource.
const loadConfigs = () => penaltyConfigService.listAll().then(completeRows);
const loadProducts = () => loanProductService.listAll().then(completeRows);

function PenaltiesContent() {
  const { can } = usePermission();
  const canListProducts = can("loans:view");
  const configsResource = useApiResource(loadConfigs);
  const productsResource = useApiResource(loadProducts, canListProducts);
  const configs = configsResource.data ?? [];
  const products = productsResource.data ?? [];
  // The form needs the product list to pick from.
  const canEdit = canListProducts && productsResource.data !== null;

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PenaltyConfig | null>(null);
  const [viewing, setViewing] = useState<PenaltyConfig | null>(null);
  const [toggling, setToggling] = useState<PenaltyConfig | null>(null);
  const [deleting, setDeleting] = useState<PenaltyConfig | null>(null);
  const [busy, setBusy] = useState(false);

  // The server names each configuration's products; the loaded list only
  // fills in, and nothing ever reads as a raw id.
  const loadedNames = productsResource.data ? new Map(productsResource.data.map((p) => [p.id, p.name])) : null;
  const productNames = (config: PenaltyConfig) => configProductNames(config, loadedNames);

  function openForm(config: PenaltyConfig | null) {
    setEditing(config);
    setFormOpen(true);
  }

  async function confirmToggle() {
    if (!toggling) return;
    const next = toggling.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await penaltyConfigService.setStatus(toggling.id, next);
      toast.success(next === "active" ? `${toggling.name} activated` : `${toggling.name} deactivated`);
      setToggling(null);
      configsResource.refetch();
    } catch (err) {
      notifyError(err, "We couldn't change the configuration's status.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await penaltyConfigService.delete(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
      configsResource.refetch();
    } catch (err) {
      notifyError(err, "We couldn't delete the configuration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Penalties</h1>
          <p className="text-sm text-muted-foreground">
            Late penalty rates by days late, for loan products. New loans copy their product&apos;s active configuration.
          </p>
        </div>
        <PermissionButton
          permission="penalties:create"
          disabled={!canEdit || configsResource.data === null}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          onClick={() => openForm(null)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Configuration
        </PermissionButton>
      </div>

      {canListProducts && productsResource.error && !productsResource.loading && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">
          Loan products could not be loaded, so configurations can&apos;t be edited right now. {productsResource.error}
        </p>
      )}
      {!canListProducts && (
        <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          Your role can&apos;t view loan products, so configurations can be viewed but not edited.
        </p>
      )}

      <DataState
        resource={configsResource}
        endpoints={[
          `GET ${API_ENDPOINTS.PENALTY_CONFIGS.LIST}`,
          `POST ${API_ENDPOINTS.PENALTY_CONFIGS.CREATE}`,
          "PUT /penalty-configs/{id}",
          "PATCH /penalty-configs/{id}/status",
          "DELETE /penalty-configs/{id}",
        ]}
        summary="Penalty configurations: late penalty rates by days late, per loan product."
      >
        {(rows) => {
          const term = search.trim().toLowerCase();
          const filtered = term ? rows.filter((c) => c.name.toLowerCase().includes(term)) : rows;
          return (
            <div className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search configurations..."
                  aria-label="Search penalty configurations"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <PenaltyTable
                configs={filtered}
                productNames={productNames}
                canEdit={canEdit}
                emptyMessage={term ? "No configurations match your search." : "No penalty configurations yet."}
                onView={setViewing}
                onEdit={openForm}
                onToggleStatus={setToggling}
                onDelete={setDeleting}
              />
            </div>
          );
        }}
      </DataState>

      <PenaltyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        config={editing}
        configs={configs}
        products={products}
        onSaved={configsResource.refetch}
      />
      <PenaltyViewDialog config={viewing} productNames={productNames} onOpenChange={(open) => !open && setViewing(null)} />
      <PenaltyStatusDialog config={toggling} busy={busy} onCancel={() => setToggling(null)} onConfirm={confirmToggle} />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "configuration"}?`}
        description={deleting ? `${deleting.name} will be removed. ${DEACTIVATE_NOTE}` : null}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default function PenaltiesPage() {
  return (
    <RouteGuard permission="penalties:view" pageName="Penalty Settings">
      <PenaltiesContent />
    </RouteGuard>
  );
}
