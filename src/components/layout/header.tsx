"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { signOut } from "@/lib/sign-out";
import {
  detailPageTitle,
  humanizeSegment,
  menuTitles,
  nestedPageTitle,
  nestedSegment,
  rootPageTitle,
  subPageTitle,
} from "@/lib/page-titles";
import { SIDEBAR_NAV } from "@/constants";
import { useMenuVisibility, useVisibleNav } from "@/hooks/use-menu-visibility";
import { breadcrumbParentShown, breadcrumbShown, paletteLinks, visibleByPath } from "@/lib/menu-visibility";
import { OWN_PROFILE_HREF, accountSettingsHref } from "@/lib/account-menu";
import type { Permission } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "./notification-bell";
import { accountMenuLabel } from "./account-menu-label";
import { WorkingBranchSelector } from "./working-branch-selector";
import { forgetUserWorkingBranch } from "@/hooks/use-working-branch";

interface HeaderProps {
  onMenuClick: () => void;
}

/** The menu's title for each route the sidebar lists. */
const menuTitle = menuTitles(SIDEBAR_NAV);

/** Map first path segment to its nav title */
function getPageTitle(segment: string): string {
  return menuTitle(`/${segment}`) ?? humanizeSegment(segment);
}

/** `editParam`: the `?edit=` value, so the loan form's edit page reads its own title. */
function Breadcrumb({ editParam }: { editParam: string | null }) {
  const pathname = usePathname();
  const { isPathHidden } = useMenuVisibility();
  const segments = pathname.split("/").filter(Boolean);

  // A page of a module Menu Visibility hides is never named.
  if (segments.length === 0 || !breadcrumbShown(pathname, isPathHidden)) return null;

  const firstSegment = segments[0];
  const pageTitle = getPageTitle(firstSegment);

  if (segments.length === 1) {
    const rootLabel = rootPageTitle(firstSegment);
    if (rootLabel === undefined) {
      return <span className="truncate text-sm font-medium text-foreground">{pageTitle}</span>;
    }
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="truncate text-muted-foreground">{pageTitle}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate font-medium text-foreground">{rootLabel}</span>
      </div>
    );
  }

  const subSegment = segments[1];
  const isId = /^\d+$/.test(subSegment);
  const subLabel = isId
    ? detailPageTitle(firstSegment, segments[2])
    : subPageTitle(firstSegment, subSegment, { edit: editParam, menuTitle });
  // A page a level further down (`/accounting/journals/new`) adds its own part.
  const nestedLabel =
    !isId && segments.length > 2
      ? nestedPageTitle(firstSegment, subSegment, nestedSegment(segments), menuTitle)
      : null;

  // On a narrow screen a three-part trail keeps only its last part, and any
  // part truncates, so the header never pushes the account menu off-screen.
  const narrowHidden = nestedLabel === null ? "" : "max-sm:hidden";
  // A section whose own page Menu Visibility hides isn't named (Dashboard
  // above Executive Dashboard while Dashboard is hidden).
  const parentShown = breadcrumbParentShown(pathname, isPathHidden);
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      {parentShown && (
        <>
          <span className={`truncate text-muted-foreground ${narrowHidden}`}>{pageTitle}</span>
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/60 ${narrowHidden}`} />
        </>
      )}
      {nestedLabel === null ? (
        <span className="truncate font-medium text-foreground">{subLabel}</span>
      ) : (
        <>
          <span className="truncate text-muted-foreground max-sm:hidden">{subLabel}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 max-sm:hidden" />
          <span className="truncate font-medium text-foreground">{nestedLabel}</span>
        </>
      )}
    </div>
  );
}

/** The breadcrumb with the query string, which needs a Suspense boundary. */
function BreadcrumbWithQuery() {
  return <Breadcrumb editParam={useSearchParams().get("edit")} />;
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
  // The menu without the modules Menu Visibility hides: the palette and the
  // account menu's Settings follow it, as the side menu does.
  const menu = useVisibleNav();
  const { isPathHidden } = useMenuVisibility();
  // The account menu's Settings: the first Settings page this user can open.
  const settingsHref = accountSettingsHref(menu, can);
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
    // Tokens are cleared before Log out goes out (it carries its own), so the
    // pollers stop at once and no "Session Expired" dialog shows. Log out is
    // best effort; local cleanup always runs.
    await signOut({
      getAccessToken: tokenManager.getAccessToken,
      clearTokens: tokenManager.clearTokens,
      forgetWorkingBranch: () => forgetUserWorkingBranch(user?.id),
      logout: authService.logout,
    });
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
      <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
        {/* Left side: hamburger (mobile) + breadcrumb; it gives way first */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
          <Suspense fallback={<Breadcrumb editParam={null} />}>
            <BreadcrumbWithQuery />
          </Suspense>
        </div>

        {/* Right side: notifications + avatar; never shrinks off-screen */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Working branch (multi-branch flag only) */}
          <WorkingBranchSelector />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notification bell with popover */}
          <NotificationBell />

          {/* User avatar only */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={accountMenuLabel(user?.full_name)}
              className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
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
              <DropdownMenuItem onClick={() => router.push(OWN_PROFILE_HREF)}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {settingsHref !== null && (
                <DropdownMenuItem onClick={() => router.push(settingsHref)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              )}
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
            {paletteLinks(menu, can).map(({ item, href }) => (
              <CommandItem
                key={item.href}
                onSelect={() => handleSelect(href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quick Actions">
            {visibleByPath(QUICK_ACTIONS, isPathHidden).filter((action) => can(action.permission)).map((action) => (
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
