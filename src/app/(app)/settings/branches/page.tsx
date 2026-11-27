"use client";

import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { PageFill, PageLoader, ScrollBox } from "@/components/common/page-fill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Building2,
  Plus,
  Pencil,
  MapPin,
  Phone,
  Search,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { env } from "@/config/env";
import { usePermission } from "@/hooks/use-permission";
import { branchService } from "@/services";
import type { ApiBranch } from "@/services/branch.service";
import { branchPageFeatures } from "@/lib/branch-page";
import { branchStatusOf } from "@/lib/branch-status";
import { BranchDetailsDialog } from "./_components/branch-details-dialog";
import { BranchFormDialog } from "./_components/branch-form-dialog";
import { MainOfficeBadge } from "./_components/main-office-action";
import { BranchStatusBadge } from "./_components/branch-status-badge";
import { BranchStatusActionButton } from "./_components/branch-status-action";
import { completeRows } from "@/lib/paginate";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function BranchesContent() {
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<ApiBranch | null>(null);
  const [detailsBranch, setDetailsBranch] = useState<ApiBranch | null>(null);
  const { can } = usePermission();
  const features = branchPageFeatures(env.features.multiBranch, can);

  // A refresh after a change keeps the page (and any open dialog) on screen;
  // only the first load shows the loader.
  const [reloadCount, setReloadCount] = useState(0);
  const fetchBranches = useCallback(() => setReloadCount((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    branchService
      .listAll()
      .then((result) => {
        if (!cancelled) setBranches(completeRows(result));
      })
      .catch(() => {
        if (!cancelled) toast.error("We couldn't load the branches. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const filtered = branches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      (b.address || "").toLowerCase().includes(q)
    );
  });

  const activeCount = branches.filter((b) => branchStatusOf(b) === "active").length;

  function handleEdit(branch: ApiBranch) {
    setEditBranch(branch);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditBranch(null);
    setFormOpen(true);
  }

  if (loading) {
    return <PageLoader />;
  }

  return (
    <PageFill>
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-sm text-muted-foreground">
            Manage lending office branches
          </p>
        </div>
        <Button
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          onClick={handleAdd}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Branch
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid shrink-0 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{branches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Suspended or Closed</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{branches.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm shrink-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search branches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className={FIT_CLASSES.section}>
        <CardContent className={cn(FIT_CLASSES.section, "p-0")}>
          <ScrollBox>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-brand-orange shrink-0" />
                        <span className="font-medium">{branch.name}</span>
                        {features.mainOffice && branch.is_main_office && <MainOfficeBadge />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{branch.code}</span>
                    </TableCell>
                    <TableCell>
                      {branch.address ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{branch.address}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {branch.contact_number ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          {branch.contact_number}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BranchStatusBadge branch={branch} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {features.details && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            aria-label={`Details of ${branch.name}`}
                            onClick={() => setDetailsBranch(branch)}
                          >
                            <Info className="h-3 w-3" aria-hidden="true" />
                            Details
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          aria-label={`Edit ${branch.name}`}
                          onClick={() => handleEdit(branch)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <BranchStatusActionButton branch={branch} onChanged={fetchBranches} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search ? "No branches match your search." : "No branches found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollBox>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <BranchFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        branch={editBranch}
        onSave={fetchBranches}
        profileFields={features.profileFields}
      />
      {features.details && (
        <BranchDetailsDialog
          branch={detailsBranch}
          onOpenChange={(open) => !open && setDetailsBranch(null)}
          features={features}
          onChanged={fetchBranches}
        />
      )}
    </PageFill>
  );
}

export default function BranchesPage() {
  return (
    <RouteGuard permission="settings:view" pageName="Branch Settings">
      <BranchesContent />
    </RouteGuard>
  );
}
