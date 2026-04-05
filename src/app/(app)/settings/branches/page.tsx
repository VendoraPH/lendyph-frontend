"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Pencil,
  MapPin,
  Phone,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { branchService } from "@/services";
import type { ApiBranch, CreateBranchData, UpdateBranchData } from "@/services/branch.service";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Branch Form Dialog
// ---------------------------------------------------------------------------

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: ApiBranch | null;
  onSave: () => void;
}

function BranchFormDialog({ open, onOpenChange, branch, onSave }: BranchFormDialogProps) {
  const isEdit = !!branch;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setCode(branch.code);
      setAddress(branch.address || "");
      setContactNumber(branch.contact_number || "");
    } else {
      setName("");
      setCode("");
      setAddress("");
      setContactNumber("");
    }
  }, [branch, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setSaving(true);
    try {
      if (isEdit && branch) {
        const data: UpdateBranchData = { name, code, address: address || undefined, contact_number: contactNumber || undefined };
        await branchService.update(branch.id, data);
        toast.success("Branch updated");
      } else {
        const data: CreateBranchData = { name, code, address: address || undefined, contact_number: contactNumber || undefined };
        await branchService.create(data);
        toast.success("Branch created");
      }
      onOpenChange(false);
      onSave();
    } catch {
      toast.error(isEdit ? "Failed to update branch" : "Failed to create branch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Branch" : "Add New Branch"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the branch details below." : "Fill in the details to create a new branch."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">
                Branch Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-name"
                placeholder="Main Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-code">
                Branch Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-code"
                placeholder="MAIN"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch-address">Address</Label>
            <Input
              id="branch-address"
              placeholder="123 Main St, Manila"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch-contact">Contact Number</Label>
            <Input
              id="branch-contact"
              type="tel"
              placeholder="09171234567"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !code.trim()}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Update Branch" : "Create Branch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BranchesPage() {
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<ApiBranch | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await branchService.list();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const filtered = branches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      (b.address || "").toLowerCase().includes(q)
    );
  });

  const activeCount = branches.filter((b) => b.is_active).length;

  async function handleToggleStatus(branch: ApiBranch) {
    try {
      await branchService.update(branch.id, { is_active: !branch.is_active });
      toast.success(`Branch ${branch.is_active ? "deactivated" : "activated"}`);
      fetchBranches();
    } catch {
      toast.error("Failed to update branch status");
    }
  }

  function handleEdit(branch: ApiBranch) {
    setEditBranch(branch);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditBranch(null);
    setFormOpen(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="grid gap-4 sm:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{branches.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search branches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                      <Badge
                        variant="outline"
                        className={cn(
                          branch.is_active
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {branch.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleEdit(branch)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-7 text-xs",
                            branch.is_active
                              ? "text-destructive border-destructive/30 hover:bg-destructive/5"
                              : "text-green-600 border-green-500/30 hover:bg-green-500/5"
                          )}
                          onClick={() => handleToggleStatus(branch)}
                        >
                          {branch.is_active ? "Deactivate" : "Activate"}
                        </Button>
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
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <BranchFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        branch={editBranch}
        onSave={fetchBranches}
      />
    </div>
  );
}
