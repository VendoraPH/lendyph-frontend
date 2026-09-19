This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment variables

All environment variables are read and given defaults in [`src/config/env.ts`](src/config/env.ts) — treat that file as the source of truth. Anything prefixed with `NEXT_PUBLIC_` is **inlined into the browser bundle at build time**, so changing one requires a rebuild (`npm run build`), not just a restart.

### Feature flags

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION` | off | Enables the **Amortization BINHS** calculator (`/loans/amortization-binhs`) — its sidebar entry under *Loans* and the route itself. Client-specific to **binhs-coop**; leave unset on every other deployment, where the nav entry is hidden and the route returns 404. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | off | Enables analytics. |

Flags are off unless explicitly set to `true` or `1`; unset or empty means off.

Lendyph is single-tenant-per-deployment and each instance builds separately on its VPS, so set these in that instance's own env file and rebuild. To keep the BINHS calculator live on `binhs.lendyph.com`:

```bash
NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION=true
```

## Tests

| Command | What it runs |
| --- | --- |
| `npm run test:unit` | Pure-logic `node:test` suites (`src/**/*.test.ts`). No DOM, no browser. |
| `npm run test:e2e` | Playwright, driving a real browser against a **deployed** environment. |

### End-to-end (Playwright)

The e2e suite signs in through the real login form and asserts against live
screens, so it needs a target and an account. Three variables, none of them
committed:

| Variable | Required | Description |
| --- | --- | --- |
| `E2E_BASE_URL` | no | Deployment under test. Defaults to `https://binhs-coop-staging.lendyph.com`. **Staging or localhost only** — `playwright.config.ts` refuses to start against any other host. |
| `E2E_USERNAME` | yes | An account holding `fees:view`. All `fees:*` permissions are admin-only (`src/constants/rbac.ts`), so this has to be an admin, and it must not be flagged `must_change_password`. |
| `E2E_PASSWORD` | yes | That account's password. |

```bash
cp .env.e2e.example .env.e2e.local   # gitignored; fill in the two credentials
npx playwright install chromium      # once per machine
npm run test:e2e
```

With the credentials unset the suite **skips** with a stated reason rather than
failing, so `npm run test:e2e` is safe to run on a machine that has no secrets.
`e2e/auth.setup.ts` signs in once and saves the session to `.auth/user.json`
(gitignored); the specs reuse it.

Deliberately **not** wired into the required CI check — a credentialed browser
job on a strict-mode required gate would block every merge whenever staging is
down.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
