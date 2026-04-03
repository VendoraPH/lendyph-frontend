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
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Pencil,
  KeyRound,
  UserCheck,
  UserX,
  Users,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { userService, roleService, branchService } from "@/services";
import type { User, UserStatus } from "@/types";
import type { ApiRole } from "@/services/role.service";
import type { ApiBranch } from "@/services/branch.service";

// ── Styling helpers ──

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

function capitalize(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Loading Spinner ──

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent",
        className
      )}
    />
  );
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
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {roles.map((role) => {
          const isSelected = value === role.name;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange(role.name)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all",
                isSelected
                  ? "border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange"
                  : "border-border hover:border-brand-orange/40 hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  isSelected
                    ? roleBadgeColor[role.name] ?? "bg-brand-orange text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs font-medium leading-tight">{capitalize(role.name)}</p>
            </button>
          );
        })}
      </div>
      {value && (() => {
        const selected = roles.find((r) => r.name === value);
        if (!selected) return null;
        return (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium mb-1">{capitalize(selected.name)} can access:</p>
            {selected.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selected.permissions.map((p) => (
                  <span key={p} className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {capitalize(p)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Full access to all features</p>
            )}
          </div>
        );
      })()}
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
    <Select
      value={value === "" ? undefined : value}
      onValueChange={(val) => onChange(val as number)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

    if (!form.first_name || !form.last_name || !form.username || !form.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.password || form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.password_confirmation) {
      toast.error("Passwords do not match");
      return;
    }
    if (!form.branch_id) {
      toast.error("Please select a branch");
      return;
    }
    if (!form.role) {
      toast.error("Please select a role");
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
      const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const firstError = Object.values(apiErrors)[0]?.[0];
        toast.error(firstError || "Validation failed");
      } else {
        toast.error(err?.response?.data?.message || "Failed to create user");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add User
      </Button>
      <DialogContent size="lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account and assign a role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-3 pb-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-first-name">First Name <span className="text-red-500">*</span></Label>
                <Input
                  id="add-first-name"
                  placeholder="Juan"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-last-name">Last Name <span className="text-red-500">*</span></Label>
                <Input
                  id="add-last-name"
                  placeholder="Dela Cruz"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-username">Username <span className="text-red-500">*</span></Label>
                <Input
                  id="add-username"
                  placeholder="juan.dc"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-email">Email <span className="text-red-500">*</span></Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-password">Password <span className="text-red-500">*</span></Label>
                <Input
                  id="add-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-confirm">Confirm Password <span className="text-red-500">*</span></Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-mobile">Mobile Number</Label>
                <Input
                  id="add-mobile"
                  type="tel"
                  placeholder="09171234567"
                  value={form.mobile_number}
                  onChange={(e) => update("mobile_number", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Branch <span className="text-red-500">*</span></Label>
                <BranchSelector
                  value={form.branch_id}
                  onChange={(v) => update("branch_id", v)}
                  branches={branches}
                />
                {!form.branch_id && submitting && (
                  <p className="text-xs text-red-500">Please select a branch</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Role <span className="text-red-500">*</span></Label>
              <RoleSelector
                value={form.role}
                onChange={(v) => update("role", v)}
                roles={roles}
              />
              {!form.role && submitting && (
                <p className="text-xs text-red-500">Please select a role</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
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
              {submitting && <Spinner className="mr-2 h-4 w-4 border-2" />}
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
    role: user.roles?.[0] ?? "",
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
        branch_id: form.branch_id as number,
        role: form.role,
      });
      toast.success("User updated successfully");
      onOpenChange(false);
      onSave();
    } catch {
      toast.error("Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update account details for {user.full_name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-3 pb-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-first-name">First Name</Label>
                <Input
                  id="edit-first-name"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-last-name">Last Name</Label>
                <Input
                  id="edit-last-name"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-mobile">Mobile Number</Label>
                <Input
                  id="edit-mobile"
                  type="tel"
                  value={form.mobile_number}
                  onChange={(e) => update("mobile_number", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <BranchSelector
                  value={form.branch_id}
                  onChange={(v) => update("branch_id", v)}
                  branches={branches}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <RoleSelector
                value={form.role}
                onChange={(v) => update("role", v)}
                roles={roles}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
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
              {submitting && <Spinner className="mr-2 h-4 w-4 border-2" />}
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
    } catch {
      toast.error("Failed to reset password");
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
              {submitting && <Spinner className="mr-2 h-4 w-4 border-2" />}
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
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (isActive) {
        await userService.deactivate(user.id);
        toast.success("User deactivated successfully");
      } else {
        await userService.reactivate(user.id);
        toast.success("User reactivated successfully");
      }
      onOpenChange(false);
      onConfirm();
    } catch {
      toast.error(
        isActive ? "Failed to deactivate user" : "Failed to reactivate user"
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            onClick={handleConfirm}
            disabled={submitting}
            className={
              isActive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-green-600 text-white hover:bg-green-700"
            }
          >
            {submitting && <Spinner className="mr-2 h-4 w-4 border-2" />}
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
        onConfirm={onRefresh}
      />
    </>
  );
}

// ── Role Summary Card ──

function RoleSummaryCard({
  role,
  count,
}: {
  role: ApiRole;
  count: number;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <Badge
            className={
              roleBadgeColor[role.name] ?? "bg-muted text-muted-foreground"
            }
          >
            {capitalize(role.name)}
          </Badge>
          <span className="text-2xl font-bold">{count}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {role.permissions.length} permissions
        </p>
      </CardContent>
    </Card>
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
      const [u, r, b] = await Promise.all([
        userService.list(),
        roleService.list(),
        branchService.list(),
      ]);
      setUsers(Array.isArray(u) ? u : (u as unknown as { data: User[] }).data ?? []);
      setRoles(Array.isArray(r) ? r : (r as unknown as { data: ApiRole[] }).data ?? []);
      setBranches(Array.isArray(b) ? b : (b as unknown as { data: ApiBranch[] }).data ?? []);
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
    const role = user.roles?.[0] ?? "";
    return (
      user.full_name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.branch?.name ?? "").toLowerCase().includes(q) ||
      role.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                User Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage users, roles, and permissions
              </p>
            </div>
            <AddUserDialog onAdd={fetchData} roles={roles} branches={branches} />
          </div>
        </CardContent>
      </Card>

      {/* Role Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-foreground text-background">
                Total
              </Badge>
              <span className="text-2xl font-bold">{users.length}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">All users</p>
          </CardContent>
        </Card>
        {roles.map((role) => (
          <RoleSummaryCard
            key={role.id}
            role={role}
            count={users.filter((u) => u.roles?.[0] === role.name).length}
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const role = user.roles?.[0] ?? "";
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            roleBadgeColor[role] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {capitalize(role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.branch?.name ?? "-"}
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
                      colSpan={6}
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
