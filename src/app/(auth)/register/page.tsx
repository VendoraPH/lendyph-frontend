"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Replace with actual authService.register() call
    setTimeout(() => {
      setIsLoading(false);
      router.push("/login");
    }, 1500);
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Column — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-orange overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-dark via-brand-orange to-brand-orange-light opacity-90" />

        {/* Decorative elements */}
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute bottom-1/4 left-10 h-48 w-48 rounded-full bg-brand-blue/20" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lendyph</h1>
            <p className="mt-1 text-sm text-white/70">
              Lending Management Platform
            </p>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight">
              Start managing your lending business today
            </h2>
            <p className="mt-4 text-lg text-white/80 leading-relaxed">
              Create your account and get full control over your borrowers,
              loans, and collections in minutes.
            </p>

            <div className="mt-10 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                <div>
                  <p className="font-semibold">Track Borrowers & Loans</p>
                  <p className="text-sm text-white/70">
                    Complete borrower profiles with loan history and payment
                    records
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                <div>
                  <p className="font-semibold">Automated Collections</p>
                  <p className="text-sm text-white/70">
                    Daily collection lists with overdue tracking and reminders
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                <div>
                  <p className="font-semibold">Role-Based Access</p>
                  <p className="text-sm text-white/70">
                    Assign Admin, Loan Officer, Cashier, Collector, or Viewer
                    roles
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                <div>
                  <p className="font-semibold">Reports & Analytics</p>
                  <p className="text-sm text-white/70">
                    Portfolio summaries, income reports, and collection rate
                    dashboards
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} Lendyph. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Column — Register Form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="text-center lg:hidden">
            <h1 className="text-3xl font-bold text-brand-orange">Lendyph</h1>
            <p className="text-sm text-muted-foreground">
              Lending Management Platform
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Create an account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started with your lending management platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Dela Cruz"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                autoComplete="name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirmation">Confirm password</Label>
              <div className="relative">
                <Input
                  id="password_confirmation"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={form.password_confirmation}
                  onChange={(e) =>
                    updateField("password_confirmation", e.target.value)
                  }
                  required
                  autoComplete="new-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreeTerms}
                onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                className="mt-0.5"
              />
              <Label
                htmlFor="terms"
                className="text-sm font-normal text-muted-foreground cursor-pointer leading-snug"
              >
                I agree to the{" "}
                <span className="font-medium text-brand-orange hover:text-brand-orange-dark cursor-pointer">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="font-medium text-brand-orange hover:text-brand-orange-dark cursor-pointer">
                  Privacy Policy
                </span>
              </Label>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              disabled={isLoading || !agreeTerms}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-brand-orange hover:text-brand-orange-dark"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
