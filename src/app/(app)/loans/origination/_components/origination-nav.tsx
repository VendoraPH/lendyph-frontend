"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermission } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Permission } from "@/types";

const BASE = "/loans/origination";

const TABS: { title: string; href: string; permission?: Permission }[] = [
  { title: "Dashboard", href: BASE },
  { title: "Applications", href: `${BASE}/applications` },
  { title: "Assessments", href: `${BASE}/assessments` },
  { title: "Documents", href: `${BASE}/documents` },
  { title: "Application Links", href: `${BASE}/links` },
  { title: "Settings", href: `${BASE}/settings`, permission: "loan_origination:settings" },
];

/** The module's sub-navigation; the sidebar only links its first screen. */
export function OriginationNav() {
  const pathname = usePathname();
  const { can } = usePermission();

  return (
    <nav className="-mx-1 shrink-0 overflow-x-auto overflow-y-hidden border-b" aria-label="Loan Origination">
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.filter((t) => !t.permission || can(t.permission)).map((tab) => {
          const active = tab.href === BASE ? pathname === BASE : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-brand-orange font-medium text-brand-orange"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
