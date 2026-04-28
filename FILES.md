# Project Folder Structure

Follow this structure strictly when adding features, components, or refactoring.

```
src/
├── app/                        # Next.js App Router (pages & layouts only)
│   ├── (auth)/                 # Auth route group (unauthenticated)
│   │   └── login/page.tsx
│   ├── (app)/                  # App route group (authenticated, shared layout)
│   │   ├── layout.tsx          # Authenticated shell (sidebar + header)
│   │   ├── dashboard/
│   │   ├── borrowers/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── _components/    # Page-scoped components (not reusable)
│   │   │   └── [id]/_components/
│   │   ├── loans/
│   │   ├── payments/
│   │   ├── collections/
│   │   ├── reports/
│   │   ├── audit-trail/
│   │   ├── users/
│   │   └── settings/
│   │       ├── profile/
│   │       ├── branches/
│   │       └── loan-products/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Root redirect
│   └── globals.css
│
├── components/                 # Shared components (used across 2+ pages)
│   ├── ui/                     # Primitives (shadcn/ui) — do NOT put business logic here
│   ├── common/                 # App-wide reusable components (permission-gate, route-guard, etc.)
│   ├── layout/                 # Shell components (header, sidebar)
│   └── providers/              # Context providers (theme, query, session)
│
├── hooks/                      # Custom React hooks (shared across pages)
│
├── services/                   # API service layer — one file per domain entity
│                               # Pattern: {entity}.service.ts
│
├── types/                      # TypeScript types/interfaces — one file per domain entity
│                               # Pattern: {entity}.ts
│
├── store/                      # Zustand stores — one file per store slice
│
├── config/                     # App config (env, site metadata, API endpoints)
│
├── constants/                  # Static values (navigation items, RBAC definitions, branch list)
│
├── lib/                        # Utility libraries & third-party wrappers (axios, api-client)
│
└── utils/                      # Pure helper functions (formatters, calculators)
```

---

## Rules

### Where to put components

| Scenario | Location |
|---|---|
| Used by only 1 page | `app/(app)/{page}/_components/` |
| Used by only 1 dynamic route page | `app/(app)/{page}/[id]/_components/` |
| Used across 2+ pages | `components/common/` |
| UI primitive (no business logic) | `components/ui/` |
| App shell (header, sidebar, nav) | `components/layout/` |
| Context provider | `components/providers/` |

### Naming conventions

- **Components:** `kebab-case.tsx` (e.g., `borrower-header.tsx`)
- **Services:** `{entity}.service.ts` (e.g., `loan.service.ts`)
- **Types:** `{entity}.ts` (e.g., `borrower.ts`)
- **Hooks:** `use-{name}.ts` (e.g., `use-auth.ts`)
- **Stores:** `{name}-store.ts` (e.g., `auth-store.ts`)
- **Constants:** `{topic}.ts` (e.g., `navigation.ts`)
- **Utils:** `{topic}.ts` (e.g., `format.ts`)
- **Page-scoped components folder:** `_components/` (underscore prefix)

### Adding a new feature page

1. Create route: `app/(app)/{feature}/page.tsx`
2. Page-specific components go in `app/(app)/{feature}/_components/`
3. Add types to `types/{entity}.ts`
4. Add API calls to `services/{entity}.service.ts`
5. If page needs state, add `store/{entity}-store.ts`
6. Re-export from barrel `index.ts` files where they exist

### When to promote a component to shared

Move from `_components/` to `components/common/` only when:
- It is used by **2 or more** pages
- It has **no page-specific business logic** baked in
- It accepts its data/behavior via **props**, not hardcoded values

### Do NOT

- Put business logic in `components/ui/` — those are pure UI primitives
- Create components directly inside `app/` route folders (use `_components/`)
- Duplicate a component instead of making it reusable in `components/common/`
- Mix API call logic into components — use `services/` layer
- Put types inline in components — define them in `types/`
- Create new top-level `src/` folders without discussion

### Barrel exports

Folders that have `index.ts` barrel files: `components/common/`, `components/providers/`, `hooks/`, `config/`, `constants/`, `services/`, `store/`, `types/`, `utils/`. Always re-export new additions from the barrel.
