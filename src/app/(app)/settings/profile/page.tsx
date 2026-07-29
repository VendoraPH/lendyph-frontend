"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { Camera, KeyRound, Loader2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services";
import type { Role } from "@/types/rbac";

// ── Helpers ──

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  loan_officer: "Loan Officer",
  loan_processor: "Loan Processor",
  cashier: "Cashier",
  general_bookkeeper: "General Bookkeeper",
  collector: "Collector",
  viewer: "Viewer",
  manager: "Manager",
  bod1: "BOD1",
  bod2: "BOD2",
  bod3: "BOD3",
  bod4: "BOD4",
  bod5: "BOD5",
  bod6: "BOD6",
  bod7: "BOD7",
};

const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin: "bg-brand-orange/10 text-brand-orange border-brand-orange/30",
  loan_officer: "bg-blue-100 text-blue-700 border-blue-200",
  loan_processor: "bg-teal-100 text-teal-700 border-teal-200",
  cashier: "bg-green-100 text-green-700 border-green-200",
  general_bookkeeper: "bg-amber-100 text-amber-700 border-amber-200",
  collector: "bg-purple-100 text-purple-700 border-purple-200",
  viewer: "bg-muted text-muted-foreground border-border",
  manager: "bg-indigo-100 text-indigo-700 border-indigo-200",
  bod1: "bg-sky-100 text-sky-700 border-sky-200",
  bod2: "bg-sky-100 text-sky-700 border-sky-200",
  bod3: "bg-sky-100 text-sky-700 border-sky-200",
  bod4: "bg-sky-100 text-sky-700 border-sky-200",
  bod5: "bg-sky-100 text-sky-700 border-sky-200",
  bod6: "bg-sky-100 text-sky-700 border-sky-200",
  bod7: "bg-sky-100 text-sky-700 border-sky-200",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

// ── Profile Card ──

function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;

  const initials = getInitials(user.full_name);
  const primaryRole = user.roles?.[0] ?? "";
  const roleLabel = (ROLE_LABELS as Record<string, string>)[primaryRole] ?? primaryRole;
  const roleBadgeClass = (ROLE_BADGE_CLASS as Record<string, string>)[primaryRole] ?? "";

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="h-20 w-20 text-xl">
              {user.avatar && <AvatarImage src={user.avatar} alt={user.full_name} />}
              <AvatarFallback className="bg-brand-orange/10 text-brand-orange font-semibold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Info */}
          <div className="flex flex-col items-center gap-2 sm:items-start sm:flex-1 min-w-0">
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold leading-tight">{user.full_name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              <Badge
                variant="outline"
                className={roleBadgeClass}
              >
                {roleLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">{user.branch?.name}</span>
            </div>
          </div>

          {/* Upload Button */}
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled
              title="Photo upload coming soon"
            >
              <Camera className="h-4 w-4" />
              Upload Photo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Edit Profile Form ──

interface ProfileForm {
  name: string;
  email: string;
  mobile: string;
}

function EditProfileCard() {
  const { user, setUser } = useAuth();

  const [form, setForm] = useState<ProfileForm>({
    name: user?.full_name ?? "",
    email: user?.email ?? "",
    mobile: user?.mobile_number ?? "",
  });
  const [saving, setSaving] = useState(false);

  const update = (field: keyof ProfileForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Only the three editable fields go to the backend. Username/branch are
  // shown read-only and not sent — admin-only per the API contract.
  const isDirty =
    form.name.trim() !== (user?.full_name ?? "") ||
    form.email.trim() !== (user?.email ?? "") ||
    form.mobile.trim() !== (user?.mobile_number ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || saving) return;

    setSaving(true);
    try {
      await authService.updateMe({
        full_name: form.name.trim(),
        email: form.email.trim(),
        mobile_number: form.mobile.trim(),
      });
      // Refetch the canonical user so the header avatar / sidebar pick up
      // the rename without a full page refresh.
      const fresh = await authService.me();
      setUser(fresh);
      setForm({
        name: fresh.full_name,
        email: fresh.email,
        mobile: fresh.mobile_number ?? "",
      });
      toast.success("Profile updated");
    } catch (err) {
      notifyError(err, "We couldn't update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-muted-foreground" />
          Edit Profile
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-name">Full Name *</Label>
              <Input
                id="profile-name"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email *</Label>
              <Input
                id="profile-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <Label htmlFor="profile-mobile">Mobile / Phone</Label>
              <Input
                id="profile-mobile"
                type="tel"
                placeholder="+63 9XX XXX XXXX"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="profile-username">
                Username
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  (read-only)
                </span>
              </Label>
              <Input
                id="profile-username"
                value={user?.username ?? ""}
                disabled
                readOnly
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <Label htmlFor="profile-branch">
                Branch
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  (read-only)
                </span>
              </Label>
              <Input
                id="profile-branch"
                value={user?.branch?.name ?? ""}
                disabled
                readOnly
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving || !isDirty}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Change Password Form ──

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

const EMPTY_PASSWORD: PasswordForm = { current: "", next: "", confirm: "" };

function ChangePasswordCard() {
  const [form, setForm] = useState<PasswordForm>(EMPTY_PASSWORD);
  const [saving, setSaving] = useState(false);

  const update = (field: keyof PasswordForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (form.next !== form.confirm) {
      toast.error("New password and confirmation do not match");
      return;
    }

    if (form.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword({
        current_password: form.current,
        new_password: form.next,
        new_password_confirmation: form.confirm,
      });
      toast.success("Password updated. Other active sessions have been signed out.");
      setForm(EMPTY_PASSWORD);
    } catch (err) {
      notifyError(err, "We couldn't update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Change Password
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Current Password */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pwd-current">Current Password *</Label>
              <Input
                id="pwd-current"
                type="password"
                placeholder="Enter current password"
                value={form.current}
                onChange={(e) => update("current", e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="pwd-new">New Password *</Label>
              <Input
                id="pwd-new"
                type="password"
                placeholder="Min. 8 characters"
                value={form.next}
                onChange={(e) => update("next", e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="pwd-confirm">Confirm New Password *</Label>
              <Input
                id="pwd-confirm"
                type="password"
                placeholder="Repeat new password"
                value={form.confirm}
                onChange={(e) => update("confirm", e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Mismatch hint */}
          {form.confirm.length > 0 && form.next !== form.confirm && (
            <p className="text-xs text-destructive">
              Passwords do not match.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              disabled={
                saving ||
                !form.current ||
                !form.next ||
                form.next !== form.confirm
              }
              className="w-full sm:w-auto"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function ProfileSettingsPage() {
  return (
    <RouteGuard permission="settings:view" pageName="Profile Settings">
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile summary card */}
      <ProfileCard />

      {/* Edit profile form */}
      <EditProfileCard />

      {/* Change password form */}
      <ChangePasswordCard />
    </div>
    </RouteGuard>
  );
}
