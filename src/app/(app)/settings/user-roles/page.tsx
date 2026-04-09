"use client";

import { useState, useMemo, useEffect } from "react";
import { RouteGuard } from "@/components/common";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ROLES } from "@/constants/rbac";
import type { Module, Action, Permission } from "@/types";
import {
  ShieldCheck,
  Search,
  Plus,
  Pencil,
  Trash2,
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Settings as SettingsIcon,
  UserCog,
  History,
  Landmark,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Module metadata — describes each feature area protected by permissions
// (Collections is excluded — no longer used in the system)
// ---------------------------------------------------------------------------

type UIModule = Exclude<Module, "collections">;

interface ModuleMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  features: string[];
}

const MODULE_META: Record<UIModule, ModuleMeta> = {
  dashboard: {
    label: "Dashboard",
    description: "Main KPI dashboard with portfolio metrics and trends.",
    icon: LayoutDashboard,
    features: [
      "View portfolio KPIs and collection trends",
      "Monitor recent transactions",
      "View charts and summary widgets",
    ],
  },
  borrowers: {
    label: "Members",
    description: "Manage borrower profiles and member records.",
    icon: Users,
    features: [
      "View and search member profiles",
      "Create new members",
      "Update member details and status",
      "Delete / archive member records",
    ],
  },
  loans: {
    label: "Loans",
    description: "Loan applications, approval, release, and lifecycle.",
    icon: FileText,
    features: [
      "View loans and loan products",
      "Create new loan applications",
      "Update loan details and amortization",
      "Approve, reject, or release loans",
      "Delete draft loans",
    ],
  },
  payments: {
    label: "Payments",
    description: "Record and manage loan payments and receipts.",
    icon: CreditCard,
    features: [
      "View payment history and receipts",
      "Record new payments",
      "Update payment records",
      "Void payments with audit trail",
    ],
  },
  share_capital: {
    label: "Share Capital",
    description: "Member share capital ledger, pledges, and auto-credit.",
    icon: Landmark,
    features: [
      "View subsidiary ledger and balances",
      "Create pledge entries and contributions",
      "Update pledge amounts and schedules",
      "Run auto-credit batches",
    ],
  },
  reports: {
    label: "Reports",
    description: "Business reports, analytics, and exports.",
    icon: BarChart3,
    features: [
      "View daily collection, portfolio, income, aging, and borrower reports",
      "Export reports to PDF or Excel",
    ],
  },
  users: {
    label: "User Management",
    description: "System users, role assignment, and access.",
    icon: UserCog,
    features: [
      "View users across branches",
      "Create new users",
      "Update user roles, branches, and credentials",
      "Delete / deactivate users",
    ],
  },
  settings: {
    label: "Settings",
    description: "System configuration: branches, profile, roles.",
    icon: SettingsIcon,
    features: [
      "View settings pages (profile, branches, roles)",
      "Update settings and system configuration",
    ],
  },
  audit_logs: {
    label: "Audit Trail",
    description: "System activity logs and audit trail.",
    icon: History,
    features: [
      "View all system actions (logins, CRUD, approvals, voids)",
      "Export audit logs",
    ],
  },
};

// Applicable actions per module — only the actions that make sense for each area
const MODULE_ACTIONS: Record<UIModule, Action[]> = {
  dashboard: ["view"],
  borrowers: ["view", "create", "update", "delete"],
  loans: ["view", "create", "update", "delete", "approve", "reject", "release"],
  payments: ["view", "create", "update", "void"],
  share_capital: ["view", "create", "update"],
  reports: ["view", "export"],
  users: ["view", "create", "update", "delete"],
  settings: ["view", "update"],
  audit_logs: ["view", "export"],
};

const ACTION_META: Record<Action, { label: string; colorClass: string }> = {
  view: { label: "View", colorClass: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
  create: { label: "Create", colorClass: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  update: { label: "Update", colorClass: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  delete: { label: "Delete", colorClass: "bg-red-500/10 text-red-700 border-red-500/30" },
  approve: { label: "Approve", colorClass: "bg-green-500/10 text-green-700 border-green-500/30" },
  reject: { label: "Reject", colorClass: "bg-red-500/10 text-red-700 border-red-500/30" },
  release: { label: "Release", colorClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  void: { label: "Void", colorClass: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  mark_collected: { label: "Mark Collected", colorClass: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
  export: { label: "Export", colorClass: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30" },
};

// ---------------------------------------------------------------------------
// Role model — local state (no mutation endpoints yet)
// ---------------------------------------------------------------------------

interface RoleItem {
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-brand-orange/10 text-brand-orange border-brand-orange/30",
  loan_officer: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  cashier: "bg-green-500/10 text-green-700 border-green-500/30",
  collector: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  viewer: "bg-slate-500/10 text-slate-700 border-slate-500/30",
};

function stripCollections(perms: Permission[]): Permission[] {
  return perms.filter((p) => !p.startsWith("collections:"));
}

function initialRoles(): RoleItem[] {
  return (Object.keys(ROLES) as (keyof typeof ROLES)[])
    .filter((k) => k !== "collector") // collector role was collections-only — no longer applicable
    .map((k) => ({
      key: k,
      label: ROLES[k].label,
      description: ROLES[k].description,
      permissions: stripCollections([...ROLES[k].permissions]),
      isSystem: true,
    }));
}

function groupByModule(permissions: Permission[]): Record<string, Action[]> {
  const map: Record<string, Action[]> = {};
  for (const p of permissions) {
    const [mod, act] = p.split(":") as [string, Action];
    if (mod === "collections") continue;
    if (!map[mod]) map[mod] = [];
    map[mod].push(act);
  }
  return map;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ---------------------------------------------------------------------------
// Role Form Dialog (Create / Edit)
// ---------------------------------------------------------------------------

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleItem | null; // null = create
  existingKeys: string[];
  onSave: (role: RoleItem) => void;
}

function RoleFormDialog({
  open,
  onOpenChange,
  role,
  existingKeys,
  onSave,
}: RoleFormDialogProps) {
  const isEdit = !!role;
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());

  useEffect(() => {
    if (open) {
      setLabel(role?.label ?? "");
      setDescription(role?.description ?? "");
      setPermissions(new Set(role?.permissions ?? []));
    }
  }, [open, role]);

  function togglePermission(mod: UIModule, act: Action) {
    const perm = `${mod}:${act}` as Permission;
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  function toggleModule(mod: UIModule, enable: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      for (const act of MODULE_ACTIONS[mod]) {
        const perm = `${mod}:${act}` as Permission;
        if (enable) next.add(perm);
        else next.delete(perm);
      }
      return next;
    });
  }

  function handleSave() {
    if (!label.trim()) {
      toast.error("Role name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    const key = isEdit && role ? role.key : slugify(label);
    if (!key) {
      toast.error("Role name must contain at least one letter or number");
      return;
    }
    if (!isEdit && existingKeys.includes(key)) {
      toast.error(`A role named "${label}" already exists`);
      return;
    }
    if (permissions.size === 0) {
      toast.error("Select at least one permission");
      return;
    }

    onSave({
      key,
      label: label.trim(),
      description: description.trim(),
      permissions: Array.from(permissions),
      isSystem: role?.isSystem ?? false,
    });
    onOpenChange(false);
    toast.success(isEdit ? "Role updated" : "Role created");
  }

  const modules = Object.keys(MODULE_META) as UIModule[];
  const totalSelected = permissions.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-orange" />
            {isEdit ? "Edit Role" : "Create New Role"}
            {role?.isSystem && (
              <Badge variant="outline" className="ml-2 text-xs gap-1">
                <Lock className="h-3 w-3" />
                System Role
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update role details and configure permissions per module."
              : "Define a new role and select which permissions it should grant."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-label">
                Role Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-label"
                placeholder="e.g. Branch Manager"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={role?.isSystem}
              />
              {role?.isSystem && (
                <p className="text-xs text-muted-foreground">
                  System role names cannot be changed
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">
                Description <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-desc"
                placeholder="Short description of this role"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Permissions matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Permissions</Label>
              <Badge variant="outline" className="text-xs">
                {totalSelected} selected
              </Badge>
            </div>

            <div className="space-y-3">
              {modules.map((mod) => {
                const meta = MODULE_META[mod];
                const Icon = meta.icon;
                const actions = MODULE_ACTIONS[mod];
                const grantedCount = actions.filter((a) =>
                  permissions.has(`${mod}:${a}` as Permission)
                ).length;
                const allSelected = grantedCount === actions.length;
                const someSelected = grantedCount > 0 && !allSelected;

                return (
                  <div
                    key={mod}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      grantedCount > 0 ? "bg-card" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                            grantedCount > 0
                              ? "bg-brand-orange/10 text-brand-orange"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {grantedCount}/{actions.length}
                        </span>
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onCheckedChange={() => toggleModule(mod, !allSelected)}
                          aria-label={`Toggle all ${meta.label} permissions`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pl-11">
                      {actions.map((act) => {
                        const perm = `${mod}:${act}` as Permission;
                        const granted = permissions.has(perm);
                        return (
                          <label
                            key={act}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer select-none transition-colors",
                              granted
                                ? ACTION_META[act].colorClass
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                            )}
                          >
                            <Checkbox
                              checked={granted}
                              onCheckedChange={() => togglePermission(mod, act)}
                              className="h-3.5 w-3.5"
                              aria-label={`${meta.label} ${ACTION_META[act].label}`}
                            />
                            {ACTION_META[act].label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            {isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleItem | null;
  onConfirm: () => void;
}

function DeleteDialog({ open, onOpenChange, role, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{role?.label}</span>? This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete Role
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UserRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>(() => initialRoles());
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formRole, setFormRole] = useState<RoleItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<RoleItem | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q)
    );
  }, [roles, search]);

  const totalModules = Object.keys(MODULE_META).length;
  const customCount = roles.filter((r) => !r.isSystem).length;

  function openCreate() {
    setFormRole(null);
    setFormOpen(true);
  }

  function openEdit(role: RoleItem) {
    setFormRole(role);
    setFormOpen(true);
  }

  function openDelete(role: RoleItem) {
    setDeleteRole(role);
    setDeleteOpen(true);
  }

  function handleSave(updated: RoleItem) {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.key === updated.key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }

  function handleDelete() {
    if (!deleteRole) return;
    setRoles((prev) => prev.filter((r) => r.key !== deleteRole.key));
    toast.success(`Role "${deleteRole.label}" deleted`);
  }

  return (
    <RouteGuard permission="settings:view" pageName="User Roles">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Roles</h1>
            <p className="text-sm text-muted-foreground">
              Define roles and configure their access rights across every system module
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{roles.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {roles.length - customCount} system, {customCount} custom
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Modules Protected</CardTitle>
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalModules}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Feature areas with access control</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{customCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">User-defined roles</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Roles Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const grouped = groupByModule(r.permissions);
                    const moduleCount = Object.keys(grouped).length;
                    return (
                      <TableRow
                        key={r.key}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openEdit(r)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-brand-orange shrink-0" />
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium",
                                ROLE_BADGE[r.key] ??
                                  "bg-slate-500/10 text-slate-700 border-slate-500/30"
                              )}
                            >
                              {r.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{r.description}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {moduleCount}{" "}
                            <span className="text-muted-foreground">of {totalModules}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.permissions.length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.isSystem ? (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 bg-muted text-muted-foreground"
                            >
                              <Lock className="h-3 w-3" />
                              System
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs bg-brand-orange/10 text-brand-orange border-brand-orange/30"
                            >
                              Custom
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(r);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-7 gap-1 text-xs",
                                !r.isSystem &&
                                  "text-destructive border-destructive/30 hover:bg-destructive/5"
                              )}
                              disabled={r.isSystem}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDelete(r);
                              }}
                              title={r.isSystem ? "System roles cannot be deleted" : "Delete role"}
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No roles match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Module reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Module Reference</CardTitle>
            <p className="text-xs text-muted-foreground">
              Every feature area protected by access control
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(MODULE_META) as UIModule[]).map((mod) => {
                const meta = MODULE_META[mod];
                const Icon = meta.icon;
                return (
                  <div key={mod} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="h-8 w-8 rounded-md bg-brand-orange/10 text-brand-orange flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <RoleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          role={formRole}
          existingKeys={roles.map((r) => r.key)}
          onSave={handleSave}
        />
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          role={deleteRole}
          onConfirm={handleDelete}
        />
      </div>
    </RouteGuard>
  );
}
