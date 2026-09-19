# Credit Scoring Module — Design Spec

**Date:** 2026-09-15
**Branch:** TBD (created at implementation start)
**Source:** User-authored requirements doc (43 sections) covering the "Recommended Phase 2 Scope" of a Lendy-internal credit scoring module.

## Overview

Add a new **Credit Scoring** main-menu module: an internal 0–100 risk score
("Lendy Credit Score") per borrower, computed from six weighted categories,
surfaced across a dashboard, a borrower list, a per-borrower profile, a
standalone assessment screen, admin scorecard configuration, risk
monitoring/alerts, score history, and settings. This PR ships the **frontend
UI shell + real data-layer scaffolding** (types, service, hooks, routes,
permissions) — no scoring computation runs anywhere yet, because there is no
backend for it. Every data-driven screen renders through `DataState`
(loading / **not connected yet** / error / empty), never fabricated numbers.
A chat-ready backend handoff (endpoints, payload/response shapes, business
rules) is delivered after implementation, not as a committed doc (per user's
standing preference — Swagger backend handoff is chat-ready, not a file).

Swagger checked at design time: `lendyph-api` swagger is currently
unreachable (HTTP 404 at the configured docs URL), so there is no existing
credit-scoring surface to diverge from — this is a clean net-new API to hand
off.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Score range | 0–100, internal only | User's explicit call — not a CIC/bureau range |
| Data source this PR | Real service/hook/`DataState` wiring, zero mock/fabricated data | User chose "UI shell only, no data" over a mock data layer; avoids throwaway code and matches accounting's precedent for pre-backend modules |
| PR sequencing | One spec, one PR, all 7 submenus + profile page | User's explicit call over phased PRs |
| Credit Assessment placement | Standalone page (`credit-scoring/assessment`) only | Embedding into the large existing `loans/new/page.tsx` is deferred to a follow-up — keeps this PR's diff to new files |
| Linda / CIC | Placeholder UI only, no functionality | Matches user's doc conclusion (Linda = Phase 2+, CIC = separate future integration) |
| Scoring computation | Not implemented anywhere (frontend or backend) in this PR | Frontend has no engine to fake; backend handoff documents the algorithm as a future implementation, not a blocking dependency for UI to exist |
| Shared hook/component reuse | Promote `useAccountingResource`→`useApiResource`, `accounting/_components/data-state.tsx`→`src/components/common/data-state.tsx` | DRY — the existing code is already fully generic; avoids duplicating it under a new name |
| Manual override / audit trail | Form UI only, disabled-with-toast when endpoint unavailable | Same "no fake success" rule as other write actions pre-backend |

## Information Architecture

### Navigation (`src/constants/navigation.ts`)

```
Credit Scoring                         credit_scoring:view
  Dashboard                 /credit-scoring
  Borrower Scores           /credit-scoring/borrowers
  Credit Assessment         /credit-scoring/assessment
  Scorecard Configuration   /credit-scoring/scorecard-configuration   credit_scoring:settings
  Risk Monitoring           /credit-scoring/risk-monitoring
  Score History             /credit-scoring/score-history
  Settings                  /credit-scoring/settings                 credit_scoring:settings
```
Add an `iconColors` entry for `/credit-scoring` in `sidebar.tsx` (new gradient, distinct from accounting's).

### Permissions (`src/types/rbac.ts`, `src/constants/rbac.ts`)

- `credit_scoring:view` — all read screens (Dashboard, Borrower Scores, profile, Assessment, Risk Monitoring, Score History)
- `credit_scoring:settings` — Scorecard Configuration + Settings pages
- `credit_scoring:override` — the manual decision/override action specifically (gates the action, not a whole page)

Grant `view` + `override` to Credit Manager / Loan Officer-equivalent roles, `settings` to Admin only — mirror however accounting's `accounting:close` vs `accounting:view` split is granted in `rbac.ts`. **Do not act on that sentence yet — see the correction immediately below.**

> **CORRECTION — added 2026-09-19, after implementation. Two fixes to this section.**
>
> **1. The verb is `settings`, not `configure`.** This spec was written saying `credit_scoring:configure`; the code shipped `credit_scoring:settings`, mirroring `accounting:settings`. The code is authoritative (`src/types/rbac.ts`, the Credit Scoring block in `src/constants/navigation.ts`, and `src/constants/rbac.ts`). The three occurrences in this section and the two further down (Scorecard Configuration, Settings, under "Screens") have been corrected in place. A backend seeded from the original wording would create a permission nothing reads, and both admin screens would stay dark for everyone.
>
> **2. Do not grant any `credit_scoring:*` permission server-side until the eleven endpoints exist.** As of 2026-09-19 `credit_scoring` appears nowhere in `lendyph-backend` on `development` or `main` — no permission, no route, no migration — while the full frontend module is live in production. It is invisible for exactly one reason: the server sends no `credit_scoring:*`, so `can()` in `sidebar.tsx` drops the block. `RouteGuard` is not a second line of defence; it reads the same `user.permissions` from the auth store, so it admits precisely the users the sidebar shows the link to.
>
> Seeding these permissions alone therefore puts seven dead menu items in front of admin, loan_officer and manager with no frontend change and no deploy. Worse, a backend that has the permissions but not the routes answers 403 or 500, and `useApiResource` marks a resource `unavailable` only on **404 or 501** (`src/hooks/use-api-resource.ts:58`) — so these screens would degrade from the intended "Not connected yet" panel to red error states.
>
> **Permissions and routes must ship in the same release.** The endpoint-by-endpoint contract is now a committed file: `docs/CREDIT_SCORING_BACKEND_HANDOFF.md` (reconstructed from the code, since the original handoff below was only ever a chat message).

### Routes

```
src/app/(app)/credit-scoring/
  page.tsx                                    Dashboard
  borrowers/page.tsx                          Borrower Scores (table + filters)
  borrowers/[id]/page.tsx                     Borrower Credit Profile
  assessment/page.tsx                         Credit Assessment (standalone)
  scorecard-configuration/page.tsx            Weights + Factor Rules + Policy Rules (tabs)
  risk-monitoring/page.tsx                    Cards + Table + Alerts
  score-history/page.tsx                      Global score-change ledger
  settings/page.tsx                           Privacy notice, model version, confidence defs, hard-flag defs
  _components/                                shared module components
```

## Data Layer

### Types — `src/types/credit-scoring.ts`

```typescript
export type RiskLevel =
  | "very_low" | "low" | "moderate" | "elevated" | "high" | "very_high";

export type ScoreConfidence = "high" | "medium" | "low";

export type ScoreType = "application" | "behavioral";

export interface ScoreCategoryBreakdown {
  category:
    | "repayment_behaviour" | "payment_capacity" | "credit_exposure"
    | "stability" | "lendy_relationship" | "application_quality";
  label: string;
  points: number;
  max_points: number;
  summary: string; // e.g. "96% of recorded payments were made on time."
}

export interface ScoreFactor {
  type: "positive" | "risk";
  label: string; // "97% of previous payments were made on time"
}

export interface CreditScore {
  id: number;
  tenant_id: number;
  borrower_id: number;
  loan_application_id: number | null;
  score: number; // 0-100
  risk_level: RiskLevel;
  confidence: ScoreConfidence;
  confidence_reason: string;
  score_type: ScoreType;
  score_model_version: string; // "1.0"
  categories: ScoreCategoryBreakdown[];
  positive_factors: ScoreFactor[];
  risk_factors: ScoreFactor[];
  system_recommendation: string; // free text, never "APPROVED"/"DENIED"
  suggested_max_monthly_payment: number | null;
  debt_service_ratio: number | null; // percent
  calculated_at: string;
}

export interface CreditScoreHistoryEntry {
  id: number;
  borrower_id: number;
  score: number;
  risk_level: RiskLevel;
  score_model_version: string;
  reason: string; // "Recent payment delinquency increased risk"
  trigger_event: string; // "payment_late" | "loan_completed" | ...
  delta: number; // signed
  calculated_at: string;
}

export interface PolicyFlag {
  id: number;
  borrower_id: number;
  type:
    | "current_past_due" | "prior_writeoff" | "existing_default"
    | "info_conflict" | "income_verification_failed"
    | "duplicate_borrower" | "active_loans_over_limit";
  message: string;
  severity: "warning" | "critical";
  created_at: string;
}

export interface CreditDecision {
  id: number;
  borrower_id: number;
  credit_score_id: number;
  original_score: number;
  original_risk_level: RiskLevel;
  system_recommendation: string;
  decision: "approved" | "declined" | "manual_review";
  reason: string;
  remarks: string | null;
  approved_by: string;
  approved_at: string;
}

export interface ScorecardCategoryConfig {
  category: ScoreCategoryBreakdown["category"];
  label: string;
  weight_percent: number; // must sum to 100 across all categories
}

export interface ScorecardFactorRule {
  category: ScorecardCategoryConfig["category"];
  factor: string; // "on_time_payment_rate"
  label: string;
  bands: { min: number; max: number; label: string; }[]; // configurable ranges
}

export interface RiskMonitoringSummary {
  score_declined_count: number;
  new_high_risk_count: number;
  past_due_borrowers_count: number;
  high_risk_exposure_total: number;
}

export interface CreditScoringDashboardSummary {
  borrowers_scored: number;
  average_score: number;
  low_risk_count: number;
  moderate_risk_count: number;
  high_risk_count: number;
  high_risk_outstanding_balance: number;
  borrowers_with_score_decline: number;
  scores_due_for_review: number;
  risk_distribution: { risk_level: RiskLevel; percent: number }[];
  risk_by_branch: { branch_id: number; branch_name: string; average_score: number; high_risk_count: number }[];
}
```

### Service — `src/services/credit-scoring.service.ts`

Typed wrapper over `api.get/post/put/delete`, methods roughly:
`getDashboardSummary`, `listBorrowerScores(filters)`, `getBorrowerCreditProfile(borrowerId)`,
`getScoreHistory(borrowerId | filters)`, `getRiskMonitoring()`, `listAlerts()`,
`getScorecardConfig()`, `updateScorecardConfig(config)`, `listPolicyFlags(borrowerId)`,
`createCreditDecision(payload)`, `getSettings()`, `updateSettings(payload)`.

URL builders added to `src/config/api-endpoints.ts` under `API_ENDPOINTS.CREDIT_SCORING`.

### Hooks

- Promote `src/hooks/use-accounting-resource.ts` → `src/hooks/use-api-resource.ts` exporting generic `useApiResource<T>(fetcher, enabled?)`. Re-export `useAccountingResource` from the same file as `export const useAccountingResource = useApiResource;` so no accounting call sites change.
- New feature hooks in `src/hooks/`: `use-credit-scoring-dashboard.ts`, `use-borrower-scores.ts`, `use-borrower-credit-profile.ts`, `use-score-history.ts`, `use-risk-monitoring.ts`, `use-scorecard-config.ts` — each a thin wrapper over `useApiResource` + the matching service call, same shape as `useChartOfAccounts`.

### Shared `DataState`

Promote `src/app/(app)/accounting/_components/data-state.tsx` → `src/components/common/data-state.tsx`. Update accounting's imports to the new path. Credit Scoring screens import the shared one directly.

## Domain Library — `src/lib/credit-scoring/`

Pure, testable helpers only — **no scoring math** (that's a backend concern; there is no borrower data on the frontend to compute from):

- `risk-level.ts` — `riskLevelLabel(level)`, `riskLevelColor(level)` (Tailwind classes, mirrors `loan-status.ts`), `riskLevelFromScore(score, thresholds)` for client-side display when the backend already returns thresholds it used.
- `confidence.ts` — `confidenceLabel(level)`, `confidenceColor(level)`.
- `scorecard-weights.ts` — `sumWeights(categories)` and `isValidWeightTotal(categories)` (must equal 100) — used only for the Scorecard Configuration form's client-side validation before submit.

Each gets a co-located `*.test.ts`, matching accounting's `src/lib/accounting/*.test.ts` pattern.

## Shared Components — `src/constants/risk-level.ts` + `credit-scoring/_components/`

- `src/constants/risk-level.ts` — `RISK_LEVEL_COLORS`, `RISK_LEVEL_LABELS` (mirrors `src/constants/loan-status.ts` exactly).
- `RiskLevelBadge` — `<Badge variant="outline" className={RISK_LEVEL_COLORS[level]}>{RISK_LEVEL_LABELS[level]}</Badge>`.
- `ConfidenceBadge` — same pattern for High/Medium/Low confidence.
- `ScoreBreakdownCard` — renders the 6-category bar/points breakdown (score 2 uses: compact on Dashboard mini-cards, full on Borrower Profile).
- `ScoreFactorList` — renders positive (✓) / risk (⚠) factor lists.
- `PolicyFlagAlert` — the "CREDIT POLICY ALERT" banner.
- `page-header.tsx` — reuse accounting's if generic enough, else a local copy following the same pattern.

## Screens

### 1. Dashboard (`/credit-scoring`)
Top cards: Borrowers Scored, Average Credit Score, Low/Moderate/High Risk counts. Second row: High Risk Outstanding Balance, Borrowers With Score Decline, Scores Due for Review. Risk Distribution chart (reuse whatever chart lib accounting's dashboard uses — recharts, per existing dependency). Portfolio Risk by Branch table. All from `useCreditScoringDashboard()` through `DataState`.

### 2. Borrower Scores (`/credit-scoring/borrowers`)
Table of all scored borrowers. Filters: Branch, Credit Score (range), Risk Level, Borrower Type, Loan Product, Active Loan, Past Due Status, Score Trend. Row click → `borrowers/[id]`.

### 3. Borrower Credit Profile (`/credit-scoring/borrowers/[id]`)
Header: name, Lendy Credit Score, `RiskLevelBadge`. `ScoreBreakdownCard` (full, 6 categories). `ScoreFactorList` (strengths/risk factors). Decision Support Panel (risk level, payment capacity, repayment history, exposure, system recommendation text — never a verdict). Suggested Loan Limit block (income/expenses/disposable income → suggested max payment vs. requested). New-borrower state: "Limited History" + `ConfidenceBadge` LOW when `score_type === "application"` and no prior loans. CIC section: static placeholder card, visibly labeled "Not available — CIC integration is a future phase," never rendered as if it were live Lendy data. Manual override action (permission-gated on `credit_scoring:override`): opens a dialog (Decision, Reason, Remarks required) → `createCreditDecision`; disabled with a toast if the endpoint is unavailable. Score History mini-chart embedded here too (same data as screen 7, scoped to this borrower).

### 4. Credit Assessment (`/credit-scoring/assessment`)
Standalone version of the panel described in section 40 of the source doc: pick a borrower (or in-flight loan application) via search, then render the same score + breakdown + factors + requested-loan-vs-suggested-payment comparison + system recommendation. This is the component that later gets embedded into `loans/new` — build it as a self-contained component from day one (`_components/credit-assessment-panel.tsx`) precisely so that follow-up is a drop-in, not a rewrite.

### 5. Scorecard Configuration (`/credit-scoring/scorecard-configuration`)
Tabs (mirrors Statements' tab pattern): **Categories** (6 weight inputs + running total, blocked from submit unless `isValidWeightTotal` passes), **Factor Configuration** (per-category factor list → click a factor → editable band table, e.g. On-Time Payment Rate 95–100% Excellent / 90–94% Good / etc.), **Policy Rules** (separate from scoring — e.g. "60+ days past due → manual review required" regardless of score). Gated on `credit_scoring:settings` (corrected 2026-09-19 — see the Permissions section).

### 6. Risk Monitoring (`/credit-scoring/risk-monitoring`)
Cards: Score Declined, New High Risk Borrowers, Past Due Borrowers, High Risk Exposure. Table of affected borrowers. Alerts list ("Credit Risk Alert: Juan's score decreased from 78 to 62 — reason, past-due balance").

### 7. Score History (`/credit-scoring/score-history`)
Global, filterable ledger of `CreditScoreHistoryEntry` across all borrowers (date, borrower, score, risk level, version, reason, trigger event) + trend chart. Distinct from the per-borrower mini view on the profile page — this is portfolio-wide, for spotting systemic drift.

### 8. Settings (`/credit-scoring/settings`)
Privacy/assessment notice text (editable static copy, section 32's sample text as default), current model version display (read-only, `score_model_version`), confidence-level definitions (read-only reference text), hard-risk-flag type definitions (read-only reference list of the `PolicyFlag` types). Gated on `credit_scoring:settings` (corrected 2026-09-19 — see the Permissions section).

## Out of Scope (explicitly deferred)

- Any real scoring computation (frontend or backend) — this PR is UI + data-layer scaffolding only.
- Embedding the assessment panel into `loans/new/page.tsx` — separate follow-up PR.
- Linda chat integration — no wiring, no chat surface changes.
- CIC integration — placeholder card only, no API, no toggle logic beyond "not available."
- Score model versioning *enforcement*, nightly recalculation jobs, ML/PD models, IFRS ECL — all backend/infra concerns noted in the handoff, not built here.

## Testing Plan

- `npx tsc --noEmit` and `npm run build` before push (standard workflow gate).
- Unit tests for every `src/lib/credit-scoring/*.ts` helper (co-located `.test.ts`), covering: risk level boundaries, confidence labeling, weight-sum validation (100 exactly, over, under, empty).
- No integration/API tests possible yet (no live backend) — `DataState`'s "not connected yet" path is the de facto coverage until endpoints exist.

## Backend Handoff Plan

Delivered as a **chat message after implementation**, not a committed file (per standing preference). Will cover, per endpoint: method/path, permission required, purpose, request payload shape, response shape (matching the types above 1:1), and business-rule notes lifted from the source doc — repayment/capacity/exposure/stability/relationship/application-quality calculation inputs (sections 5–11), recalculation triggers (section 35), multi-tenant scoping (`tenant_id` from the authenticated account only, never trusted from the request body), score versioning (`score_model_version` stamped at calculation time, immutable per history row), and the human-approval requirement (system never auto-decides — `system_recommendation` is advisory text only).
