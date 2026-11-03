"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, usePermission } from "@/hooks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  LogOut,
  User,
  Menu,
  ChevronRight,
  Settings,
  FilePlus,
  CreditCard,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { humanizeSegment, subPageTitle } from "@/lib/page-titles";
import { SIDEBAR_NAV } from "@/constants";
import type { Permission } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LindaTrigger } from "@/components/linda/linda-trigger";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  onMenuClick: () => void;
}

/** Map first path segment to its nav title */
function getPageTitle(segment: string): string {
  for (const item of SIDEBAR_NAV) {
    if (item.href === `/${segment}`) {
      return item.title;
    }
  }
  return humanizeSegment(segment);
}

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const firstSegment = segments[0];
  const pageTitle = getPageTitle(firstSegment);

  if (segments.length === 1) {
    return (
      <span className="text-sm font-medium text-foreground">{pageTitle}</span>
    );
  }

  const subSegment = segments[1];
  const isId = /^\d+$/.test(subSegment);
  const subLabel = isId ? "Detail" : subPageTitle(firstSegment, subSegment);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{pageTitle}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
      <span className="font-medium text-foreground">{subLabel}</span>
    </div>
  );
}

// Each carries the permission its page needs to do the action, so the palette
// offers only what the user can finish, as the sidebar does.
const QUICK_ACTIONS: { title: string; href: string; icon: typeof FilePlus; permission: Permission }[] = [
  { title: "New Loan", href: "/loans/new", icon: FilePlus, permission: "loans:create" },
  { title: "Record Payment", href: "/payments", icon: CreditCard, permission: "payments:create" },
];

export function Header({ onMenuClick }: HeaderProps) {
  const { user, clearAuth } = useAuth();
  const { can } = usePermission();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setCommandOpen(false);
      router.push(href);
    },
    [router],
  );

  const handleLogout = async () => {
    // Backend logout can fail (token already revoked, session expired, 500)
    // but client-side logout must always succeed. Swallow the API error and
    // proceed with local cleanup + redirect.
    try {
      await authService.logout();
    } catch {
      /* ignore — local cleanup runs unconditionally below */
    }
    tokenManager.clearTokens();
    localStorage.removeItem("lendy_remember_me");
    clearAuth();
    toast.success("Logged out");
    router.replace("/login");
  };

  const initials = user?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
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

        {/* Right side: notifications + avatar */}
        <div className="flex items-center gap-2">
          {/* Linda, the AI lending assistant (hidden unless enabled) */}
          <LindaTrigger />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notification bell with popover */}
          <NotificationBell />

          {/* User avatar only */}
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-brand-orange text-brand-orange-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/settings/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/settings/loan-products")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Command palette dialog */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {SIDEBAR_NAV.filter((item) => can(item.permission)).map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => handleSelect(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quick Actions">
            {QUICK_ACTIONS.filter((action) => can(action.permission)).map((action) => (
              <CommandItem
                key={action.href}
                onSelect={() => handleSelect(action.href)}
              >
                <action.icon className="mr-2 h-4 w-4" />
                {action.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
