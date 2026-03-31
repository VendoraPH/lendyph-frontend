"use client";

import { useAuth } from "@/hooks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Menu, Search, Bell, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { ROLES } from "@/constants/rbac";
import { SIDEBAR_NAV } from "@/constants";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

/** Map first path segment to its nav title */
function getPageTitle(segment: string): string {
  for (const item of SIDEBAR_NAV) {
    // Match by href, e.g. "/dashboard" -> "dashboard"
    if (item.href === `/${segment}`) {
      return item.title;
    }
  }
  // Fallback: capitalize
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

/** Map sub-segment to readable label */
function getSubLabel(segment: string): string {
  const labels: Record<string, string> = {
    new: "New Application",
    products: "Loan Products",
    amortization: "Amortization",
    history: "History",
  };
  return (
    labels[segment] ||
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const firstSegment = segments[0];
  const pageTitle = getPageTitle(firstSegment);

  // Single segment, e.g. /dashboard
  if (segments.length === 1) {
    return (
      <span className="text-sm font-medium text-foreground">{pageTitle}</span>
    );
  }

  // Two or more segments, e.g. /loans/products or /borrowers/1
  const subSegment = segments[1];
  const isId = /^\d+$/.test(subSegment);
  const subLabel = isId ? "Detail" : getSubLabel(subSegment);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{pageTitle}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
      <span className="font-medium text-foreground">{subLabel}</span>
    </div>
  );
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, clearAuth } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      tokenManager.clearTokens();
      localStorage.removeItem("lendy_remember_me");
      clearAuth();
      toast.success("Logged out successfully");
      router.replace("/login");
    }
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = user?.role ? ROLES[user.role]?.label : "";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      {/* Left side: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
        <Breadcrumb />
      </div>

      {/* Right side: search + notifications + user */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>

        <div className="ml-1 flex items-center gap-3">
          <div className="hidden sm:block text-right text-sm">
            <p className="font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-brand-orange text-brand-orange-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
