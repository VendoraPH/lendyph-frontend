"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Pencil,
  KeyRound,
  UserCheck,
  UserX,
  Users,
  ShieldCheck,
  FileText,
  Wallet,
  ClipboardList,
  Eye,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { userService } from "@/services/user.service";
import { roleService } from "@/services/role.service";
import { branchService } from "@/services/branch.service";
import type { ApiRole } from "@/services/role.service";
import type { ApiBranch } from "@/services/branch.service";
import type { User, UserStatus, Role } from "@/types";
import type { LucideIcon } from "lucide-react";

// ── Constants ──

const roleIcons: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  loan_officer: FileText,
  cashier: Wallet,
  collector: ClipboardList,
  viewer: Eye,
};

const roleBadgeColor: Record<string, string> = {
  admin: "bg-brand-orange text-brand-orange-foreground",
  loan_officer: "bg-brand-blue text-brand-blue-foreground",
  cashier: "bg-green-600 text-white",
  collector: "bg-purple-600 text-white",
  viewer: "bg-muted text-muted-foreground",
};

const statusBadge: Record<UserStatus, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
};

function getRoleLabel(roleName: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    loan_officer: "Loan Officer",
    cashier: "Cashier",
    collector: "Collector",
    viewer: "Viewer",
  };
  return labels[roleName] ?? roleName;
}

function getUserPrimaryRole(user: User): string {
  return user.roles[0] ?? "viewer";
}

// ── Role Selector Component ──

function RoleSelector({
  value,
  onChange,
  roles,
}: {
  value: string;
  onChange: (role: string) => void;
  roles: ApiRole[];
}) {
  return (
    <div className="grid gap-2">
      {roles.map((role) => {
        const Icon = roleIcons[role.name] ?? Eye;
        const isSelected = value === role.name;
        return (
          <button
            key={role.name}
            type="button"
            onClick={() => onChange(role.name)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
              isSelected
                ? "border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange"
                : "border-border hover:border-brand-orange/40 hover:bg-muted/50"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isSelected
                  ? roleBadgeColor[role.name] ?? "bg-brand-orange text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{getRoleLabel(role.name)}</p>
            </div>
            <div
              className={cn(
                "h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                isSelected
                  ? "border-brand-orange bg-brand-orange"
                  : "border-muted-foreground/30"
              )}
            >
              {isSelected && (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Branch Selector Component ──

function BranchSelector({
  value,
  onChange,
  branches,
}: {
  value: number | "";
  onChange: (branchId: number) => void;
  branches: ApiBranch[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {branches.map((branch) => (
        <button
          key={branch.id}
          type="button"
          onClick={() => onChange(branch.id)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left",
            value === branch.id
              ? "border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange text-brand-orange"
              : "border-border hover:border-brand-orange/40 hover:bg-muted/50 text-foreground"
          )}
        >
          {branch.name}
        </button>
      ))}
    </div>
  );
}

// ── Add User Dialog ──

function AddUserDialog({
  onAdd,
  roles,
  branches,
}: {
  onAdd: () => void;
  roles: ApiRole[];
  branches: ApiBranch[];
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    mobile_number: "",
    password: "",
    password_confirmation: "",
    role: "",
    branch_id: "" as number | "",
  });

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () =>
    setForm({
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      mobile_number: "",
      password: "",
      password_confirmation: "",
      role: "",
      branch_id: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role || !form.branch_id) {
      toast.error("Please select a role and branch");
      return;
    }
    if (form.password !== form.password_confirmation) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await userService.create({
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
        password: form.password,
        password_confirmation: form.password_confirmation,
        mobile_number: form.mobile_number || undefined,
        branch_id: form.branch_id as number,
        role: form.role,
      });
      toast.success("User created successfully");
      resetForm();
      setOpen(false);
      onAdd();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-brand-orange-foreground hover:bg-brand-orange-dark transition-colors">
        <UserPlus className="h-4 w-4" />
        Add User
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account and assign a role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-first-name">First Name</Label>
              <Input
                id="add-first-name"
                placeholder="Juan"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-last-name">Last Name</Label>
              <Input
                id="add-last-name"
                placeholder="Dela Cruz"
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-username">Username</Label>
              <Input
                id="add-username"
                placeholder="juan.dc"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="name@lendy.ph"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-confirm">Confirm Password</Label>
              <Input
                id="add-confirm"
                type="password"
                placeholder="Re-enter password"
                value={form.password_confirmation}
                onChange={(e) =>
                  update("password_confirmation", e.target.value)
                }
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-mobile">Mobile Number (optional)</Label>
            <Input
              id="add-mobile"
              type="tel"
              placeholder="09171234567"
              value={form.mobile_number}
              onChange={(e) => update("mobile_number", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Branch</Label>
            <BranchSelector
              value={form.branch_id}
              onChange={(v) => update("branch_id", v)}
              branches={branches}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <RoleSelector
              value={form.role}
              onChange={(v) => update("role", v)}
              roles={roles}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose
              render={<Button type="button" variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit User Dialog (controlled) ──

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSave,
  roles,
  branches,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  roles: ApiRole[];
  branches: ApiBranch[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    mobile_number: user.mobile_number ?? "",
    role: getUserPrimaryRole(user),
    branch_id: user.branch?.id ?? ("" as number | ""),
  });

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await userService.update(user.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        mobile_number: form.mobile_number || undefined,
        branch_id: form.branch_id as number || undefined,
        role: form.role || undefined,
      });
      toast.success("User updated successfully");
      onOpenChange(false);
      onSave();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update account details for {user.full_name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First Name</Label>
              <Input
                id="edit-first-name"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last Name</Label>
              <Input
                id="edit-last-name"
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mobile">Mobile Number</Label>
              <Input
                id="edit-mobile"
                type="tel"
                value={form.mobile_number}
                onChange={(e) => update("mobile_number", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Branch</Label>
            <BranchSelector
              value={form.branch_id}
              onChange={(v) => update("branch_id", v)}
              branches={branches}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <RoleSelector
              value={form.role}
              onChange={(v) => update("role", v)}
              roles={roles}
            />
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
              disabled={submitting}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog (controlled) ──

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return;
    setSubmitting(true);
    try {
      await userService.resetPassword(user.id, {
        password,
        password_confirmation: confirm,
      });
      toast.success("Password reset successfully");
      setPassword("");
      setConfirm("");
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.full_name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">New Password</Label>
            <Input
              id="reset-password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm">Confirm Password</Label>
            <Input
              id="reset-confirm"
              type="password"
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {password && confirm && password !== confirm && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
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
              disabled={!password || password !== confirm || submitting}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle Status Dialog (controlled) ──

function ToggleStatusDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isActive = user.status === "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-orange" />
            {isActive ? "Deactivate" : "Activate"} User
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Are you sure you want to deactivate ${user.full_name}? They will no longer be able to access the system.`
              : `Are you sure you want to activate ${user.full_name}? They will regain access to the system.`}
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

// ── User Actions Cell ──

function UserActionsCell({
  user,
  onRefresh,
  roles,
  branches,
}: {
  user: User;
  onRefresh: () => void;
  roles: ApiRole[];
  branches: ApiBranch[];
}) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const isActive = user.status === "active";

  const handleToggleStatus = async () => {
    try {
      if (isActive) {
        await userService.deactivate(user.id);
        toast.success("User deactivated");
      } else {
        await userService.reactivate(user.id);
        toast.success("User reactivated");
      }
      onRefresh();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? "Failed to update user status");
    }
  };

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
          <DropdownMenuItem onClick={() => setOpenDialog("reset")}>
            <KeyRound className="mr-2 h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog("status")}>
            {isActive ? (
              <UserX className="mr-2 h-4 w-4" />
            ) : (
              <UserCheck className="mr-2 h-4 w-4" />
            )}
            {isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserDialog
        user={user}
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSave={onRefresh}
        roles={roles}
        branches={branches}
      />
      <ResetPasswordDialog
        user={user}
        open={openDialog === "reset"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
      />
      <ToggleStatusDialog
        user={user}
        open={openDialog === "status"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={handleToggleStatus}
      />
    </>
  );
}

// ── Role Summary Card ──

function RoleSummaryCard({
  roleName,
  users,
  apiRole,
}: {
  roleName: string;
  users: User[];
  apiRole?: ApiRole;
}) {
  const count = users.filter((u) => u.roles.includes(roleName)).length;
  const Icon = roleIcons[roleName] ?? Eye;

  return (
    <Dialog>
      <DialogTrigger className="w-full text-left">
        <Card className="cursor-pointer hover:border-brand-orange/40 transition-colors">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Badge className={roleBadgeColor[roleName] ?? "bg-muted text-muted-foreground"}>
                {getRoleLabel(roleName)}
              </Badge>
              <span className="text-2xl font-bold">{count}</span>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {getRoleLabel(roleName)} Permissions
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {apiRole && apiRole.permissions.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {apiRole.permissions.map((perm) => {
                  const parts = perm.split(":");
                  const mod = parts[0];
                  const action = parts.slice(1).join(":");
                  return (
                    <Badge key={perm} variant="outline" className="text-xs gap-1">
                      <span className="font-semibold text-brand-orange">
                        {mod}
                      </span>
                      <span className="text-muted-foreground">:</span>
                      <span>{action}</span>
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground pt-2 mt-3 border-t">
                {apiRole.permissions.length} permissions assigned
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No permissions data available.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        userService.list(),
        roleService.list(),
        branchService.list(),
      ]);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setRoles(Array.isArray(rolesRes) ? rolesRes : []);
      setBranches(Array.isArray(branchesRes) ? branchesRes : []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.branch?.name ?? "").toLowerCase().includes(q) ||
      user.roles.some((r) => getRoleLabel(r).toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Team Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their roles
          </p>
        </div>
        <AddUserDialog onAdd={fetchData} roles={roles} branches={branches} />
      </div>

      {/* Role Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {roles.map((role) => (
          <RoleSummaryCard
            key={role.id}
            roleName={role.name}
            users={users}
            apiRole={role}
          />
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            All Users ({filteredUsers.length})
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const primaryRole = getUserPrimaryRole(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.username}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.mobile_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            roleBadgeColor[primaryRole] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {getRoleLabel(primaryRole)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.branch?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadge[user.status]}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <UserActionsCell
                          user={user}
                          onRefresh={fetchData}
                          roles={roles}
                          branches={branches}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
