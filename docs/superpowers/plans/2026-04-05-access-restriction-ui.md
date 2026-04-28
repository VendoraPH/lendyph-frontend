# Access Restriction UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the existing RBAC system to the UI so users see permission-appropriate navigation, informative access-denied pages, and locked action buttons.

**Architecture:** Three layers of enforcement — sidebar filters nav items by permission, each page wraps content in `<RouteGuard>` that renders `<AccessDenied>` when denied, and action buttons use `<PermissionButton>` to show lock icon + tooltip when the user lacks permission. All client-side using the existing `usePermission` hook and auth store.

**Tech Stack:** Next.js 16, React, Base UI, Tailwind CSS, Zustand, Lucide icons

---

### Task 1: Create `<AccessDenied>` Component

**Files:**
- Create: `src/components/common/access-denied.tsx`

- [ ] **Step 1: Create the AccessDenied component**

Create `src/components/common/access-denied.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks";
import { ROLES } from "@/constants/rbac";
import type { Permission, Module } from "@/types";

const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  borrowers: "Borrowers",
  loans: "Loans",
  payments: "Payments",
  collections: "Collections",
  reports: "Reports",
  settings: "Settings",
  users: "User Management",
  audit_logs: "Audit Trail",
};

function getAccessibleModules(permissions: Permission[]): string[] {
  const modules = new Set<string>();
  for (const p of permissions) {
    const mod = p.split(":")[0] as Module;
    if (p.endsWith(":view") && MODULE_LABELS[mod]) {
      modules.add(MODULE_LABELS[mod]);
    }
  }
  return Array.from(modules);
}

interface AccessDeniedProps {
  pageName?: string;
}

export function AccessDenied({ pageName }: AccessDeniedProps) {
  const router = useRouter();
  const { role, permissions } = usePermission();

  const roleConfig = role ? ROLES[role] : null;
  const accessibleModules = getAccessibleModules(permissions);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/30">
          <ShieldX className="h-8 w-8 text-brand-orange" />
        </div>

        <h1 className="text-xl font-bold tracking-tight">Access Restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have permission to view{" "}
          {pageName ? <strong>{pageName}</strong> : "this page"}.
        </p>

        {roleConfig && (
          <div className="mt-6 rounded-xl border bg-card p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your Access
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="outline" className="font-semibold">
                  {roleConfig.label}
                </Badge>
              </div>
              {accessibleModules.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">
                    You can access:{" "}
                    {accessibleModules.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            onClick={() => router.push("/dashboard")}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            Go to Dashboard
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          If you think this is a mistake, contact your administrator.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from common index**

Add to `src/components/common/index.ts`:

```ts
export { AccessDenied } from "./access-denied";
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/common/access-denied.tsx src/components/common/index.ts
git commit -m "feat: add AccessDenied component for permission-restricted pages"
```

---

### Task 2: Update `<RouteGuard>` to Render `<AccessDenied>`

**Files:**
- Modify: `src/components/common/route-guard.tsx`

- [ ] **Step 1: Rewrite RouteGuard**

Replace the entire contents of `src/components/common/route-guard.tsx` with:

```tsx
"use client";

import { usePermission } from "@/hooks";
import { AccessDenied } from "./access-denied";
import type { Permission } from "@/types";

interface RouteGuardProps {
  permission: Permission;
  pageName?: string;
  children: React.ReactNode;
}

export function RouteGuard({
  permission,
  pageName,
  children,
}: RouteGuardProps) {
  const { can } = usePermission();

  if (!can(permission)) {
    return <AccessDenied pageName={pageName} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/common/route-guard.tsx
git commit -m "feat: RouteGuard now renders AccessDenied instead of redirecting"
```

---

### Task 3: Filter Sidebar Navigation by Permission

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add usePermission import**

In `src/components/layout/sidebar.tsx`, add the import at the top with the other imports (after line 7):

```ts
import { usePermission } from "@/hooks";
```

- [ ] **Step 2: Filter nav items in the sidebar body**

In `src/components/layout/sidebar.tsx`, find the nav rendering section (around line 248):

```tsx
{SIDEBAR_NAV.map((item) => (
```

Replace with a filtered version. Add `usePermission` inside the component that renders the nav. Find the component that contains the `SIDEBAR_NAV.map` call and add at the top of that component:

```tsx
const { can } = usePermission();
```

Then change line 248 from:

```tsx
{SIDEBAR_NAV.map((item) => (
```

to:

```tsx
{SIDEBAR_NAV.filter((item) => can(item.permission)).map((item) => (
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: filter sidebar nav items by user permissions"
```

---

### Task 4: Create `<PermissionButton>` Component

**Files:**
- Create: `src/components/common/permission-button.tsx`
- Modify: `src/components/common/index.ts`

- [ ] **Step 1: Create the PermissionButton component**

Create `src/components/common/permission-button.tsx`:

```tsx
"use client";

import { LockKeyhole } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermission } from "@/hooks";
import type { Permission } from "@/types";
import type { VariantProps } from "class-variance-authority";
import type { Button as ButtonPrimitive } from "@base-ui/react/button";

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

interface PermissionButtonProps extends ButtonProps {
  permission: Permission;
  tooltip?: string;
}

export function PermissionButton({
  permission,
  tooltip = "Your role doesn't have permission to do this",
  children,
  className,
  ...props
}: PermissionButtonProps) {
  const { can } = usePermission();

  if (can(permission)) {
    return (
      <Button className={className} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={className}
            {...props}
            disabled
          />
        }
      >
        <LockKeyhole className="mr-1 h-3.5 w-3.5" />
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Export from common index**

Add to `src/components/common/index.ts`:

```ts
export { PermissionButton } from "./permission-button";
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/common/permission-button.tsx src/components/common/index.ts
git commit -m "feat: add PermissionButton with lock icon and tooltip for restricted actions"
```

---

### Task 5: Add Route Guards to All Pages

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/users/page.tsx`
- Modify: `src/app/(app)/borrowers/page.tsx`
- Modify: `src/app/(app)/borrowers/new/page.tsx`
- Modify: `src/app/(app)/loans/page.tsx`
- Modify: `src/app/(app)/loans/new/page.tsx`
- Modify: `src/app/(app)/payments/page.tsx`
- Modify: `src/app/(app)/collections/page.tsx`
- Modify: `src/app/(app)/reports/page.tsx`
- Modify: `src/app/(app)/audit-trail/page.tsx`
- Modify: `src/app/(app)/settings/branches/page.tsx`
- Modify: `src/app/(app)/settings/profile/page.tsx`
- Modify: `src/app/(app)/settings/loan-products/page.tsx`

For each page, wrap the returned JSX with `<RouteGuard>`. The pattern is the same for every page:

1. Add import at top: `import { RouteGuard } from "@/components/common";`
2. Wrap the page's top-level return with `<RouteGuard permission="..." pageName="...">`

- [ ] **Step 1: Add RouteGuard to dashboard**

In `src/app/(app)/dashboard/page.tsx`, add import and wrap the return:

```tsx
import { RouteGuard } from "@/components/common";
```

Wrap the return of `DashboardPage` with:
```tsx
return (
  <RouteGuard permission="dashboard:view" pageName="Dashboard">
    {/* existing content */}
  </RouteGuard>
);
```

- [ ] **Step 2: Add RouteGuard to users page**

In `src/app/(app)/users/page.tsx`, add import and wrap `UsersPage` return with:
```tsx
<RouteGuard permission="users:view" pageName="User Management">
```

- [ ] **Step 3: Add RouteGuard to borrowers page**

In `src/app/(app)/borrowers/page.tsx`:
```tsx
<RouteGuard permission="borrowers:view" pageName="Borrowers">
```

- [ ] **Step 4: Add RouteGuard to borrowers/new page**

In `src/app/(app)/borrowers/new/page.tsx`:
```tsx
<RouteGuard permission="borrowers:create" pageName="Add Borrower">
```

- [ ] **Step 5: Add RouteGuard to loans page**

In `src/app/(app)/loans/page.tsx`:
```tsx
<RouteGuard permission="loans:view" pageName="Loans">
```

- [ ] **Step 6: Add RouteGuard to loans/new page**

In `src/app/(app)/loans/new/page.tsx`:
```tsx
<RouteGuard permission="loans:create" pageName="New Loan Application">
```

- [ ] **Step 7: Add RouteGuard to payments page**

In `src/app/(app)/payments/page.tsx`:
```tsx
<RouteGuard permission="payments:view" pageName="Payments">
```

- [ ] **Step 8: Add RouteGuard to collections page**

In `src/app/(app)/collections/page.tsx`:
```tsx
<RouteGuard permission="collections:view" pageName="Collections">
```

- [ ] **Step 9: Add RouteGuard to reports page**

In `src/app/(app)/reports/page.tsx`:
```tsx
<RouteGuard permission="reports:view" pageName="Reports">
```

- [ ] **Step 10: Add RouteGuard to audit-trail page**

In `src/app/(app)/audit-trail/page.tsx`:
```tsx
<RouteGuard permission="audit_logs:view" pageName="Audit Trail">
```

- [ ] **Step 11: Add RouteGuard to settings pages**

In `src/app/(app)/settings/branches/page.tsx`:
```tsx
<RouteGuard permission="settings:view" pageName="Branch Settings">
```

In `src/app/(app)/settings/profile/page.tsx`:
```tsx
<RouteGuard permission="settings:view" pageName="Profile Settings">
```

In `src/app/(app)/settings/loan-products/page.tsx`:
```tsx
<RouteGuard permission="settings:view" pageName="Loan Product Settings">
```

- [ ] **Step 12: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 13: Commit**

```bash
git add src/app/
git commit -m "feat: add RouteGuard permission checks to all pages"
```

---

### Task 6: Add PermissionButton to Key Actions

**Files:**
- Modify: `src/app/(app)/users/page.tsx` (Add User button)
- Modify: `src/app/(app)/borrowers/page.tsx` (Add Borrower button)
- Modify: `src/app/(app)/loans/page.tsx` (New Loan Application link/button)
- Modify: `src/app/(app)/payments/page.tsx` (Record Payment button)
- Modify: `src/app/(app)/collections/page.tsx` (Mark Collected button)

For each page, find the primary action button and replace `<Button>` with `<PermissionButton>`. Import `PermissionButton` from `@/components/common`.

- [ ] **Step 1: Users page — Add User button**

In `src/app/(app)/users/page.tsx`, the `AddUserDialog` component renders the "Add User" button. Since it's inside a dialog trigger, wrap the dialog's open trigger. In the `AddUserDialog` component, replace the `<Button onClick={() => setOpen(true)}>` with a `<PermissionButton>`:

Import at top of file:
```tsx
import { PermissionButton } from "@/components/common";
```

Find the Add User button (the one with `onClick={() => setOpen(true)}`):
```tsx
<Button
  onClick={() => setOpen(true)}
  className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
>
  <UserPlus className="mr-2 h-4 w-4" />
  Add User
</Button>
```

Replace with:
```tsx
<PermissionButton
  permission="users:create"
  tooltip="Your role doesn't have permission to create users"
  onClick={() => setOpen(true)}
  className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
>
  <UserPlus className="mr-2 h-4 w-4" />
  Add User
</PermissionButton>
```

- [ ] **Step 2: Borrowers page — Add Borrower button**

In `src/app/(app)/borrowers/page.tsx`, find the "Add Borrower" button/link and replace with `<PermissionButton>`. Import `PermissionButton` and use `permission="borrowers:create"`.

- [ ] **Step 3: Loans page — New Loan button**

In `src/app/(app)/loans/page.tsx`, find the "New Loan Application" button/link. If it's a `<Link>`, wrap it with `<PermissionGate permission="loans:create">` to hide it, or replace with a `<PermissionButton>` that uses `router.push`. Use `permission="loans:create"`.

- [ ] **Step 4: Payments page — Record Payment action**

In `src/app/(app)/payments/page.tsx`, find the "Record Payment" or primary action button. Replace with `<PermissionButton permission="payments:create">`.

- [ ] **Step 5: Collections page — Mark Collected button**

In `src/app/(app)/collections/page.tsx`, find the "Mark Collected" or "Mark as Collected" button. Replace with `<PermissionButton permission="collections:mark_collected">`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat: add PermissionButton to key action buttons across pages"
```

---

### Task 7: Final Build Verification and Push

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (pre-existing e2e errors are acceptable)

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Push branch and create PR**

Follow the git workflow:
1. Check for conflicts: `git fetch origin development && git merge origin/development --no-commit --no-ff`
2. Push: `git push -u origin <branch-name>`
3. Create PR: `gh pr create --base development`
4. Verify mergeable: `gh pr view <number> --json mergeable`
5. Return to development: `git checkout development && git pull`
