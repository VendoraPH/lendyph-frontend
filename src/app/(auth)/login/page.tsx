"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks";
import type { User } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Replace with actual authService.login() call
    // Mock user for testing — remove when backend is connected
    const mockUser: User = {
      id: 1,
      name: "Augustin Maputol",
      username: "augustin",
      email: form.email || "admin@lendyph.com",
      mobile: "09171234567",
      role: "admin",
      branch: "main",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTimeout(() => {
      setUser(mockUser);
      setIsLoading(false);
      router.push("/dashboard");
    }, 1000);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Column — Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-orange overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-dark via-brand-orange to-brand-orange-light opacity-90" />

        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 right-10 h-48 w-48 rounded-full bg-brand-blue/20" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lendyph</h1>
            <p className="mt-1 text-sm text-white/70">Lending Management Platform</p>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight">
              Manage your lending business with confidence
            </h2>
            <p className="mt-4 text-lg text-white/80 leading-relaxed">
              Track borrowers, process loans, collect payments, and monitor your
              portfolio — all in one place.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-6">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <p className="text-3xl font-bold text-brand-blue">98%</p>
                <p className="mt-1 text-sm text-white/70">Collection Rate</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <p className="text-3xl font-bold text-brand-blue">2.5k+</p>
                <p className="mt-1 text-sm text-white/70">Active Borrowers</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <p className="text-3xl font-bold text-brand-blue">₱15M</p>
                <p className="mt-1 text-sm text-white/70">Portfolio Managed</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <p className="text-3xl font-bold text-brand-blue">5</p>
                <p className="mt-1 text-sm text-white/70">User Roles</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} Lendyph. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Column — Login Form */}
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
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-brand-orange hover:text-brand-orange-dark"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  required
                  autoComplete="current-password"
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
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) =>
                  setRememberMe(checked as boolean)
                }
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal text-muted-foreground cursor-pointer"
              >
                Remember me for 30 days
              </Label>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
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
            Don&apos;t have an account?{" "}
            <a
              href="/register"
              className="font-medium text-brand-orange hover:text-brand-orange-dark"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
