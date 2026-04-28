"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks";
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
  Bell,
  ChevronRight,
  Settings,
  FilePlus,
  CreditCard,
  DollarSign,
  AlertTriangle,
  FileText,
  Check,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { SIDEBAR_NAV } from "@/constants";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";

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
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

/** Map sub-segment to readable label */
function getSubLabel(segment: string): string {
  const labels: Record<string, string> = {
    new: "New Application",
    products: "Loan Products",
    amortization: "Amortization Calculator",
    history: "History",
    profile: "Profile",
    "loan-products": "Loan Products",
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

  if (segments.length === 1) {
    return (
      <span className="text-sm font-medium text-foreground">{pageTitle}</span>
    );
  }

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

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

interface Notification {
  id: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    title: "Payment Received",
    description: "Rosario D. Santos paid ₱3,933 via GCash",
    time: "2 min ago",
    read: false,
    icon: DollarSign,
    iconColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10",
  },
  {
    id: 2,
    title: "Loan Overdue",
    description: "Ana Santos — LN-2026-0091 is 3 days overdue",
    time: "15 min ago",
    read: false,
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-500/10",
  },
  {
    id: 3,
    title: "New Loan Application",
    description: "Carmen Torres applied for a ₱50,000 loan",
    time: "1 hr ago",
    read: false,
    icon: FileText,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    id: 4,
    title: "Payment Received",
    description: "Roberto Garcia paid ₱9,417 — cash payment",
    time: "2 hrs ago",
    read: true,
    icon: DollarSign,
    iconColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10",
  },
  {
    id: 5,
    title: "Loan Approved",
    description: "Eduardo Mendoza — LN-2026-0103 has been approved",
    time: "3 hrs ago",
    read: true,
    icon: Check,
    iconColor: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-500/10",
  },
];

const QUICK_ACTIONS = [
  { title: "New Loan", href: "/loans/new", icon: FilePlus },
  { title: "Record Payment", href: "/payments", icon: CreditCard },
];

export function Header({ onMenuClick }: HeaderProps) {
  const { user, clearAuth } = useAuth();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
    toast.success("Logged out successfully");
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
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notification bell with popover */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative rounded-full text-muted-foreground hover:bg-muted/50"
                />
              }
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h4 className="text-sm font-semibold">Notifications</h4>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        !n.read ? "bg-brand-orange/5" : ""
                      }`}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.iconBg}`}>
                        <n.icon className={`h-4 w-4 ${n.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {n.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {n.time}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

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
            {SIDEBAR_NAV.map((item) => (
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
            {QUICK_ACTIONS.map((action) => (
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
