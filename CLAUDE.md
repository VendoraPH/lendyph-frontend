# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

`lendyph-web` — the Next.js 16 (App Router) / React 19 / TypeScript frontend of Lendyph, a cooperative lending app. Its only backend is the separate Laravel API, `lendyph-backend`. One codebase serves several **single-tenant deployments that differ only by build-time env**: there is no tenant model, so anything one client needs goes behind an env flag (e.g. `NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION`), never a branch.

The backend's `routes/api.php` is the endpoint source of truth. `docs/API_ENDPOINTS.md` is an April 2026 snapshot, and "not built yet" notes in code lag the backend. For example, `src/services/accounting.service.ts` says none of its endpoints exist, but the backend serves `/accounting/*`. Check the backend before assuming an endpoint is missing or present.

## Commands

```bash
npm run dev                               # next dev
npm run lint                              # eslint, incl. the local `pagination` plugin
npm run typecheck                         # tsc --noEmit
npm run test:unit                         # node:test via tsx over src/**/*.test.ts (Node >= 22)
npx tsx --test src/lib/paginate.test.ts   # a single file
npm run build                             # `prebuild` runs scripts/check-env.mjs first
npm run test:e2e                          # Playwright against a DEPLOYED staging env
npx playwright test e2e/fees-settings.spec.ts
```

- **Build env gate.** `npm run build` refuses to run unless the `REQUIRED_IN_PRODUCTION` vars in `src/config/env.ts` are set (in the environment, `.env.local` or `.env`). Locally, `cp .env.example .env`.
- **Build-time env.** `NEXT_PUBLIC_*` values are inlined at build time, so changing one needs a rebuild. Only *literal* `process.env.NEXT_PUBLIC_X` references reach the browser. The `getEnvVar(key)`-style helpers read by dynamic key, so the browser sees their defaults.
- **New `NEXT_PUBLIC_*` var.** Read it in `src/config/env.ts` and add it to `.env.example`; CI runs `check-env.mjs --docs-only`.
- **Unit tests.** They are pure logic: no DOM, and only `*.test.ts` is collected, so a `.test.tsx` never runs. On Node 20 the glob silently matches nothing. Service tests start a `node:http` stub on 127.0.0.1 and set `NEXT_PUBLIC_API_URL` before importing the service; see `src/services/list-truncation.test.ts`.
- **E2E.**
  - There is no `webServer`. `playwright.config.ts` throws for any host that is not localhost and does not contain "staging".
  - Credentials go in `.env.e2e.local`: `E2E_USERNAME` / `E2E_PASSWORD` for an admin that is not flagged `must_change_password`. Without them the suite skips.
  - E2E is not part of CI.
- **CI.** `.github/workflows/ci.yml` runs the required check **TypeScript & Build Check**:
  1. `npm audit --audit-level=high`
  2. `check-env.mjs --docs-only`
  3. lint
  4. `tsc`
  5. unit tests (fails if zero ran)
  6. `npm run build` against `.env.example`

  PRs into `development` must also pass **Merge Conflict Check**.
- **Pre-push hook.** `.husky/pre-push` is the only hook, and it runs `tsc` plus a full `npm run build` on every push, so pushes are slow. On a feature branch it first rebases onto `origin/development` (`--rebase-merges`) unless that is already an ancestor. On an already-pushed branch that rewrites history, so merge `origin/development` in before pushing.

## Architecture

**Request path.**
- Browser code calls `/api/proxy/*` (`src/lib/axios-client.ts`). `next.config.ts` rewrites that server-side to `${NEXT_PUBLIC_API_URL}/*`.
- So browser traffic is same-origin, and the build's API URL decides which tenant database it talks to.
- Keep `proxyTimeout` (90 s) above the axios timeout (60 s), or the user gets a bare 500. Keep `proxyClientMaxBodySize` at 25 MB for ID uploads.
- Code running outside the browser, including unit tests, calls `NEXT_PUBLIC_API_URL` directly.

**API layer.**
- Endpoint paths live in `src/config/api-endpoints.ts` (`API_ENDPOINTS`). There is one `xxxService` object per resource in `src/services/`, and domain types are in `src/types/`.
- `api.get/post/put/patch/delete/upload` (`src/lib/api-client.ts`) return `response.data.data`. They unwrap the `{success, data}` envelope and **drop pagination `meta`**.
- `api.getRaw` / `rawPost` / … return the whole body. Some endpoints (login, token refresh) are flat. Both families are typed `Promise<T>`, so TypeScript won't catch the wrong helper.

**Pagination.**
- List endpoints silently clamp `per_page` to 100; report endpoints return 422 above 1000.
- To get every row, use `fetchAllPages` (`src/lib/paginate.ts`) through a service's `listAll`, and render `IncompleteListNotice` when the result is `truncated`.
- Several list endpoints return `meta.stats` (global per-status counts). Use it for tabs and KPI cards instead of counting the rows you received.
- ESLint enforces `per_page <= 100` (`pagination/no-oversized-per-page`).

**Data and state.**
- The house pattern is a service call in a `useCallback` fetcher, run by `useEffect`, with results in `useState`.
  - Parallel loads use `Promise.allSettled`.
  - Refetch after a mutation through callbacks such as `onSave={fetchData}`.
  - `useApiResource` (`src/hooks/use-api-resource.ts`) wraps this and treats 404/501 as `unavailable`.
- Global state is zustand (`src/store/`: auth, persisted as `lendy-auth`; ui; branding).
- Forms are hand-rolled `useState` objects with `notifyValidation`. Toasts go through `src/lib/notify.ts`.
- These are installed but unused, so don't introduce them as if they were the pattern:
  - TanStack Query: its provider is mounted, but nothing calls it.
  - react-hook-form, zod, `@tanstack/react-table`, the `@radix-ui/*` packages and sweetalert2.
- UI primitives are shadcn (`base-nova` style, built on `@base-ui/react`) in `src/components/ui/`. Tailwind 4 is configured in CSS (`src/app/globals.css`); there is no tailwind config file.

**Auth and permissions are client-side only.**
- There is no `middleware.ts` / `proxy.ts`. `src/app/(app)/layout.tsx` redirects to `/login` when there is no token, and renders nothing until the user is loaded. The API is the real enforcer.
- The bearer token is stored in localStorage.
- The axios interceptor does one queued refresh on 401. On **423** (`password_change_required`) it sends the user to `/change-password`. A 423 must never reach the refresh path.
- Permissions are `module:action` strings from the server's `user.permissions`. Check them with `usePermission()`, and gate with:
  - `RouteGuard`: a whole page.
  - `PermissionGate`: hide something.
  - `PermissionButton`: a disabled button with a tooltip.
- `src/constants/rbac.ts` only documents roles for the roles screen; editing it grants nothing.
- The sidebar is `SIDEBAR_NAV` in `src/constants/navigation.ts`, filtered by permission.

**Routes and modules.**
- `src/app/(app)` is the authenticated shell: dashboard, borrowers, loans, payments, collaterals, share-capital, gcash, accounting, reports, credit-scoring, settings, users, and more.
- `(auth)` holds login and change-password; `(public)` holds self-registration.
- Almost every page is a client component.
- Module-private code sits beside its route in `_components/`, `_hooks/` and `_lib/`, and tests sit beside the code they test.
- Credit scoring is UI-only. Its backend contract is `docs/CREDIT_SCORING_BACKEND_HANDOFF.md`, and it stays hidden because no one holds `credit_scoring:*`.

**Reports and printables.**
- Reports live in `src/app/(app)/reports/_lib/`. `report-builders.ts` turns API payloads into a `ReportDocument`. There is one exporter per format (PDF, docx, xlsx, csv), each loaded with `await import()` on click so it stays out of the page bundle.
- Printables (receipts, promissory notes, demand letters, …) are HTML-string templates in `src/lib/printables/templates/`, opened in a new tab to print.

**Docs.** `docs/superpowers/specs/` and `docs/superpowers/plans/` hold dated design specs and implementation plans per feature. `docs/*_BACKEND_HANDOFF.md` are frontend-to-backend API contracts.

## Pitfalls

- **Dates.** The app runs on Asia/Manila (UTC+8), and `toISOString()` gives yesterday's date before 08:00. Build `YYYY-MM-DD` with `formatDateISO` / `todayISO` from `src/lib/format.ts`; ESLint bans `toISOString().split/slice`. API timestamps are UTC ISO strings, so parse them before comparing.
- **Formatting.** Use `src/lib/format.ts`. `src/utils/format.ts` is a legacy duplicate whose currency output differs (2 decimals vs whole pesos); the collateral screens still use it.
- **Images.** API-served images use plain `<img>`, never `next/image`. `images.remotePatterns` only allows `/storage/**`, and KYC files come from signed, expiring `/api/files/**` URLs.
- **Bundle size.** `src/components/common/index.ts` is not tree-shaken, and nearly every page imports `RouteGuard` from it. Never re-export heavy components such as `SubjectPicker` there; import them by path.

## Branches and deploys

Branch from `development` and open PRs into `development`; `main` is production. Everything auto-deploys on push:

- `development` goes to the staging boxes and the portfolio demo.
- `main` goes to **both production frontends immediately**, so the `development` → `main` promotion PR is the release gate.

A `.github/**`-only change deploys nothing. Dependabot targets `development`.
