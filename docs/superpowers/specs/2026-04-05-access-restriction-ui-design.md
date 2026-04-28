# Access Restriction UI — Design Spec

**Date:** 2026-04-05
**Status:** Approved

## Overview

Implement a user-friendly permission enforcement UI across the Lendy.PH app. Users should clearly understand when they can't access something, why, and what they can do instead.

The app already has a full RBAC system (types, role definitions, permission hooks, `PermissionGate`, `RouteGuard`) — but none of it is wired up in the UI. This spec covers activating it.

## Decisions

| Question | Decision |
|----------|----------|
| Page-level restriction | Show inline access-denied page (not redirect) |
| Access-denied style | Informative card with role, branch, permissions summary |
| Action-level restriction | Show disabled button + lock icon + tooltip |
| Sidebar navigation | Hide items user can't access |

## Components

### 1. `<AccessDenied>` Component

**File:** `src/components/common/access-denied.tsx`

A full-page replacement shown when a user lacks permission for a route.

**Props:**
- `permission?: Permission` — The permission that was required (for display)
- `pageName?: string` — Human-readable name of the restricted page (e.g., "User Management")

**Content:**
- Shield/lock icon (from lucide)
- "Access Restricted" heading
- Message: "You don't have permission to view {pageName}."
- Info card showing:
  - **Role** — User's primary role (e.g., "Cashier"), styled with role badge color
  - **Branch** — User's assigned branch
  - **Permissions summary** — Short list of modules they CAN access (derived from their role's permissions)
- Two action buttons:
  - "Go to Dashboard" (primary, brand-orange)
  - "Go Back" (outline, calls `router.back()`)
- Footer: "If you think this is a mistake, contact your administrator."

**Styling:** Centered vertically in the page content area, uses existing design tokens (brand-orange, muted-foreground, etc.). Should work in both light and dark mode.

### 2. Update `<RouteGuard>` Component

**File:** `src/components/common/route-guard.tsx`

**Current behavior:** Redirects to `fallbackUrl` when permission denied.

**New behavior:** Renders `<AccessDenied>` component instead of redirecting. Remove the `fallbackUrl` prop — it's no longer needed.

**Props (updated):**
- `permission: Permission` — Required permission
- `pageName?: string` — Human-readable page name for the denied message
- `children: React.ReactNode`

### 3. `<PermissionButton>` Component

**File:** `src/components/common/permission-button.tsx`

A wrapper around the existing `<Button>` that checks permissions before enabling.

**Props:**
- `permission: Permission` — Required permission
- `tooltip?: string` — Custom tooltip text (default: "Your role doesn't have permission to do this")
- All standard `ButtonProps` passed through

**Behavior when user lacks permission:**
- Button renders as `disabled` with reduced opacity
- A small `LockKeyhole` icon (from lucide) is prepended to the button content
- On hover, a tooltip appears with the restriction message
- Click events are suppressed (disabled)

**Behavior when user has permission:**
- Button renders normally, no lock icon, no tooltip
- All props and events pass through unchanged

**Uses:** The existing `usePermission().can()` hook for checking.

### 4. Sidebar Permission Filtering

**File:** `src/components/layout/sidebar.tsx`

**Change:** Before rendering each nav item, check `can(item.permission)`. Only render items the user has access to.

**Implementation:** In the nav item rendering loop, wrap with the `usePermission` hook:
```
const { can } = usePermission();
const visibleItems = SIDEBAR_NAV.filter(item => can(item.permission));
```

Same logic applies to any sub-items with permissions.

### 5. Route Guards on All Pages

Wrap each page's content with `<RouteGuard>`:

| Route | Permission | Page Name |
|-------|-----------|-----------|
| `/dashboard` | `dashboard:view` | Dashboard |
| `/users` | `users:view` | User Management |
| `/borrowers` | `borrowers:view` | Borrowers |
| `/borrowers/new` | `borrowers:create` | Add Borrower |
| `/loans` | `loans:view` | Loans |
| `/loans/new` | `loans:create` | New Loan Application |
| `/payments` | `payments:view` | Payments |
| `/collections` | `collections:view` | Collections |
| `/reports` | `reports:view` | Reports |
| `/audit-trail` | `audit_logs:view` | Audit Trail |
| `/settings/*` | `settings:view` | Settings |

### 6. Action-Level Permission Enforcement

Replace key action buttons across the app with `<PermissionButton>`:

| Page | Action | Permission |
|------|--------|-----------|
| Users | Add User | `users:create` |
| Borrowers | Add Borrower | `borrowers:create` |
| Loans | New Loan Application | `loans:create` |
| Loans | Approve/Reject | `loans:approve` / `loans:reject` |
| Loans | Release | `loans:release` |
| Payments | Record Payment | `payments:create` |
| Payments | Void | `payments:void` |
| Collections | Mark Collected | `collections:mark_collected` |

## What's NOT in scope

- **Middleware-based enforcement** — All checks are client-side using the auth store. The API already enforces permissions server-side.
- **Permission management UI** — Roles and permissions are predefined in constants, not editable by users.
- **Granular field-level restrictions** — Only page-level and action-level enforcement.

## Existing code to leverage

| File | What it provides |
|------|-----------------|
| `src/types/rbac.ts` | `Role`, `Module`, `Action`, `Permission` types |
| `src/constants/rbac.ts` | `ROLES` map with all role-permission mappings |
| `src/constants/navigation.ts` | `SIDEBAR_NAV` with `permission` field on each item |
| `src/hooks/use-permission.ts` | `can()`, `canAny()`, `canAll()`, `isRole()`, `isAdmin()` |
| `src/store/auth-store.ts` | `hasPermission()`, `hasAnyPermission()`, `hasRole()` |
| `src/components/common/permission-gate.tsx` | Conditional rendering by permission |
| `src/components/common/route-guard.tsx` | Page-level guard (to be updated) |
| `src/components/ui/tooltip.tsx` | Tooltip component for disabled buttons |
