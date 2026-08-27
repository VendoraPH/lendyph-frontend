<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:coding-standards -->
# Coding Standards

## Principles (apply to every task, not just refactoring)

**DRY** — If the same logic appears in two places, it belongs in a shared hook, util, or component. Before writing new code, check whether a shared abstraction already exists.

**KISS** — Prefer the simplest solution that works. Avoid layers of abstraction that don't earn their keep. Three similar lines of code is better than a premature abstraction.

**Reusability** — Pure functions go in `src/lib/`. Shared hooks go in `src/hooks/`. Shared UI goes in `src/components/`. Module-specific code stays in the module's `_components/` or `_hooks/` folders.

**Performance** — No expensive computations inline in render. Use `useMemo`/`useCallback` where the dependency list is stable and the cost is real. Split large modules with Next.js `dynamic()`.

## File Size

- Components over ~200 lines: candidate to split into subcomponents
- Hooks over ~100 lines: candidate to split into smaller hooks
- Avoid putting types, components, hooks, and utils all in one file

## Naming

- Components: `PascalCase`
- Hooks: `useCamelCase`
- Utils / helpers: `camelCase`
- Files: `kebab-case`

## What to Avoid

- Duplicating fetch logic — always check if a `useXxx` hook exists for the resource
- Prop drilling more than 2 levels — extract context or collocate state
- Inline `toLocaleString` / date formatting — use `src/lib/format.ts`
- Writing one-off currency or date logic — check for existing utils first
<!-- END:coding-standards -->
