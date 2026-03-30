"use client";

import { useState } from "react";
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
  Trash2,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLES, ROLE_OPTIONS, BRANCHES } from "@/constants";
import type { Role, UserStatus } from "@/types";
import type { LucideIcon } from "lucide-react";

// ── Types ──

interface MockUser {
  id: number;
  name: string;
  username: string;
  email: string;
  mobile: string;
  role: Role;
  branch: string;
  status: UserStatus;
  created_at: string;
}

// ── Constants ──

const INITIAL_USERS: MockUser[] = [
  {
    id: 1,
    name: "Augustin Maputol",
    username: "augustin",
    email: "augustin@lendyph.com",
    mobile: "09171234567",
    role: "admin",
    branch: "main",
    status: "active",
    created_at: "2026-01-15",
  },
  {
    id: 2,
    name: "Maria Santos",
    username: "maria.santos",
    email: "maria@lendyph.com",
    mobile: "09181234567",
    role: "loan_officer",
    branch: "cebu",
    status: "active",
    created_at: "2026-02-01",
  },
  {
    id: 3,
    name: "Juan Dela Cruz",
    username: "juan.dc",
    email: "juan@lendyph.com",
    mobile: "09191234567",
    role: "cashier",
    branch: "main",
    status: "active",
    created_at: "2026-02-10",
  },
  {
    id: 4,
    name: "Ana Reyes",
    username: "ana.reyes",
    email: "ana@lendyph.com",
    mobile: "09201234567",
    role: "collector",
    branch: "davao",
    status: "active",
    created_at: "2026-03-01",
  },
  {
    id: 5,
    name: "Pedro Garcia",
    username: "pedro.g",
    email: "pedro@lendyph.com",
    mobile: "09211234567",
    role: "viewer",
    branch: "manila",
    status: "inactive",
    created_at: "2026-03-15",
  },
];

const roleIcons: Record<Role, LucideIcon> = {
  admin: ShieldCheck,
  loan_officer: FileText,
  cashier: Wallet,
  collector: ClipboardList,
  viewer: Eye,
};

const roleBadgeColor: Record<Role, string> = {
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

function getBranchLabel(value: string) {
  return BRANCHES.find((b) => b.value === value)?.label ?? value;
}

// ── Role Selector Component ──

function RoleSelector({
  value,
  onChange,
}: {
  value: Role | "";
  onChange: (role: Role) => void;
}) {
  return (
    <div className="grid gap-2">
      {ROLE_OPTIONS.map((role) => {
        const Icon = roleIcons[role.value];
        const isSelected = value === role.value;
        return (
          <button
            key={role.value}
            type="button"
            onClick={() => onChange(role.value)}
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
                  ? roleBadgeColor[role.value]
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{role.label}</p>
              <p className="text-xs text-muted-foreground">
                {role.description}
              </p>
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
}: {
  value: string;
  onChange: (branch: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {BRANCHES.map((branch) => (
        <button
          key={branch.value}
          type="button"
          onClick={() => onChange(branch.value)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left",
            value === branch.value
              ? "border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange text-brand-orange"
              : "border-border hover:border-brand-orange/40 hover:bg-muted/50 text-foreground"
          )}
        >
          {branch.label}
        </button>
      ))}
    </div>
  );
}

// ── Add User Dialog ──

function AddUserDialog({ onAdd }: { onAdd: (user: MockUser) => void }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    mobile: "",
    password: "",
    password_confirmation: "",
    role: "" as Role | "",
    branch: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () =>
    setForm({
      name: "",
      username: "",
      email: "",
      mobile: "",
      password: "",
      password_confirmation: "",
      role: "",
      branch: "",
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role || !form.branch) return;

    const newUser: MockUser = {
      id: Date.now(),
      name: form.name,
      username: form.username,
      email: form.email,
      mobile: form.mobile,
      role: form.role as Role,
      branch: form.branch,
      status: "active",
      created_at: new Date().toISOString().split("T")[0]!,
    };
    onAdd(newUser);
    resetForm();
  };

  return (
    <Dialog>
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
              <Label htmlFor="add-name">Full Name</Label>
              <Input
                id="add-name"
                placeholder="Juan Dela Cruz"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="name@lendyph.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-mobile">Mobile Number</Label>
              <Input
                id="add-mobile"
                type="tel"
                placeholder="09171234567"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
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
            <Label>Branch</Label>
            <BranchSelector
              value={form.branch}
              onChange={(v) => update("branch", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <RoleSelector
              value={form.role}
              onChange={(v) => update("role", v)}
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
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
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
}: {
  user: MockUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: MockUser) => void;
}) {
  const [form, setForm] = useState({ ...user });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update account details for {user.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
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
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Branch</Label>
            <BranchSelector
              value={form.branch}
              onChange={(v) => update("branch", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <RoleSelector
              value={form.role}
              onChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
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
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
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
  user: MockUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return;
    // TODO: call userService.resetPassword(user.id, { password, password_confirmation: confirm })
    setPassword("");
    setConfirm("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name}.
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
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              disabled={!password || password !== confirm}
            >
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
  user: MockUser;
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
              ? `Are you sure you want to deactivate ${user.name}? They will no longer be able to access the system.`
              : `Are you sure you want to activate ${user.name}? They will regain access to the system.`}
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

// ── Delete User Dialog (controlled) ──

function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
}: {
  user: MockUser;
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
            Delete User
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete {user.name}? This action
            cannot be undone.
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

// ── User Actions Cell ──

function UserActionsCell({
  user,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  user: MockUser;
  onEdit: (updated: MockUser) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
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
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserDialog
        user={user}
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSave={onEdit}
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
        onConfirm={onToggleStatus}
      />
      <DeleteUserDialog
        user={user}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onDelete}
      />
    </>
  );
}

// ── Permissions Dialog ──

function PermissionsDialog({ role }: { role: Role }) {
  return (
    <Dialog>
      <DialogTrigger className="w-full text-left">
        <Card className="cursor-pointer hover:border-brand-orange/40 transition-colors">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Badge className={roleBadgeColor[role]}>
                {ROLES[role].label}
              </Badge>
              <span className="text-2xl font-bold">
                {INITIAL_USERS.filter((u) => u.role === role).length}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {ROLES[role].description}
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {ROLES[role].label} Permissions
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {ROLES[role].description}
          </p>
          <div className="max-h-80 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {ROLES[role].permissions.map((perm) => {
                const [mod, action] = perm.split(":");
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
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            {ROLES[role].permissions.length} permissions assigned
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

export default function UsersPage() {
  const [users, setUsers] = useState<MockUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      getBranchLabel(user.branch).toLowerCase().includes(q) ||
      ROLES[user.role].label.toLowerCase().includes(q)
    );
  });

  const handleAdd = (newUser: MockUser) => {
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleEdit = (updated: MockUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u))
    );
  };

  const handleToggleStatus = (id: number) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "active" ? "inactive" : "active" as UserStatus }
          : u
      )
    );
  };

  const handleDelete = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Create, edit, and manage user accounts
          </p>
        </div>
        <AddUserDialog onAdd={handleAdd} />
      </div>

      {/* Role Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {ROLE_OPTIONS.map((r) => (
          <PermissionsDialog key={r.value} role={r.value} />
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
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.username}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.mobile}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleBadgeColor[user.role]}>
                        {ROLES[user.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getBranchLabel(user.branch)}
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
                        onEdit={handleEdit}
                        onToggleStatus={() => handleToggleStatus(user.id)}
                        onDelete={() => handleDelete(user.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
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
