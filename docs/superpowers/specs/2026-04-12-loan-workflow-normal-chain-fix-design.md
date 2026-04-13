# Normal Loan Approval Chain Fix

**Date:** 2026-04-12
**Scope:** `src/services/approval-workflow.service.ts`

## Problem

The default "normal" (non-policy-exception) loan approval chain is wrong. Today it is:

1. Loan Processor (submit)
2. Manager (approve)
3. BOD Chairwoman (release)

The Chairwoman is effectively forced to act as the cashier, and the cashier role is never involved in the normal flow. The intended flow separates confirmation from release:

1. Loan Processor (submit)
2. Manager (approve)
3. BOD Chairwoman (approve — confirmation)
4. Cashier (release)

The policy-exception chain already ends with a Cashier release step, so the normal chain is the only one that needs correcting.

## Goal

Correct `DEFAULT_NORMAL_CHAIN` so fresh installations get the right 4-step flow. Existing cooperatives that have saved a custom chain in localStorage are not touched.

## Change

### `src/services/approval-workflow.service.ts` (lines 36–41)

Replace the current `DEFAULT_NORMAL_CHAIN` with:

```ts
// Normal loan flow — Manager approval, Chairwoman confirmation, Cashier release
const DEFAULT_NORMAL_CHAIN: ApprovalChainStep[] = [
  { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
  { id: "manager", name: "Manager", role: "manager", kind: "approve" },
  { id: "chairwoman", name: "BOD Chairwoman", role: "bod1", kind: "approve" },
  { id: "cashier", name: "Cashier", role: "cashier", kind: "release" },
];
```

Two differences from the current code:

1. The `chairwoman` step's `kind` changes from `"release"` to `"approve"`.
2. A new `cashier` step is appended with `kind: "release"`.

The header comment above the constant is updated to reflect the four-step flow.

No other code is touched.

## Why the Validator Still Passes

`validateChain` (same file) enforces: first step must be `submit`, last step must be `release`, and all step `id`s must be unique. The new chain satisfies all three:

- First step: `loan-processor` (submit). ✓
- Last step: `cashier` (release). ✓
- IDs `loan-processor`, `manager`, `chairwoman`, `cashier` are all distinct. ✓

No validator changes are needed.

## Out of Scope

- **RBAC / permissions.** The Cashier role's `loans:release` permission is not touched in this change. The same situation already applies to the policy-exception chain, which today also ends in a Cashier release step. If the cashier user cannot actually perform the release action, that is a separate pre-existing defect outside the scope of this spec.
- **Settings UI (`src/app/(app)/settings/approval-workflow/page.tsx`).** Already supports arbitrary-length chains; no changes required.
- **Loan detail page (`src/app/(app)/loans/[id]/page.tsx`).** Consumes `approvalWorkflowService.listNormal()` and renders whatever it returns; no changes required.
- **Existing saved configurations.** `listNormal` reads from the `approval-workflow-config-normal` localStorage key first and only falls back to the default when nothing is saved. Any browser with an existing saved chain continues to show that saved chain. Users who want the new default can click Reset in the settings page.
- **Backend migration.** There is no backend storage for approval chain configurations today — all state is client-side localStorage — so there is nothing to migrate.

## Testing

Manual browser verification on the `/settings/approval-workflow` page:

1. **Fresh state (no saved normal chain).** Clear `localStorage` key `approval-workflow-config-normal`. Load the page, switch to the Normal tab. Expect exactly 4 steps in order: Loan Processor (submit) → Manager (approve) → BOD Chairwoman (approve) → Cashier (release).
2. **Regression check — existing saved chain.** With some saved chain already under `approval-workflow-config-normal`, reload the page. Expect the saved chain to render unchanged.
3. **Reset behavior.** Click the Reset button on the Normal tab. Expect the page to show the new 4-step default.
4. **Typecheck.** Run `pnpm typecheck` (or `bun run typecheck`) and confirm no errors.
