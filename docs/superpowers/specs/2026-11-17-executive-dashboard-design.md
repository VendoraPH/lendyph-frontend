# Executive Dashboard (2026-11-17)

ClickUp: Phase 6 › Dashboard (14zfbg0dnq3). Route: `/dashboard/executive` (`dashboard:view`), linked from `/dashboard`.

## Approach

No new backend endpoint. The page combines the aggregate report endpoints that already exist, one request per source, in parallel. Each source settles on its own, so a slow or failed report never blanks the page.

- **Permissions.** Report reads need `reports:view`, the ledger figures need `accounting:view`, and the pipeline counts need `loans:view`. A source the user lacks is never requested and shows "No access".
- **No mock data.** A figure that failed or never arrived reads **Data Unavailable**, never `0`. Percent change is not shown when the previous value is zero or missing.
- **Three kinds of metric:**
  - **balance**: a position. Outstanding, PAR, past due and active loans are always **as of today**, because loan records keep no history. Share capital and the required allowance are as of the period's last day.
  - **period**: a flow over the range (released, collections, net income). Compared with the previous period of the same length, or with the whole previous month for a calendar month.
  - **ratio**: collection efficiency, compared in percentage points.
- **Filters.** Ten presets plus a custom range, a branch filter (the caller's own branches unless they hold `branches:view_all`), Refresh, and an export to PDF, Excel or CSV through the reports module's exporters (`reportId: "executive_dashboard"`, reference prefix `EXD`).
- **Requires Attention** raises items only from data that loaded:
  - books out of balance;
  - PAR 30 ≥ 5% (critical at ≥ 10%);
  - collection rate < 90% (critical below 80%);
  - anything over 90 days;
  - applications for review, or approved and awaiting release;
  - unposted journals;
  - loan adjustments clearing needing review.

## Sources

| Source | Endpoint | Params |
|---|---|---|
| balance | `GET /reports/loan-balance-summary` | `branch_id` only (its dates filter by release date) |
| products | `GET /reports/portfolio-by-product` | `branch_id` |
| aging, provisioning | `/reports/aging`, `/reports/provisioning` | `as_of_date` = period end |
| cash flow, collection efficiency, performance, share capital, income, borrowers, disbursements | `/reports/*` | `date_from`/`date_to` (plus the previous period for cash flow, efficiency and disbursements) |
| accounting | `GET /accounting/dashboard` | `as_of`, `from`, `branch_id` (centavos) |
| loanStats | `GET /loans?per_page=1` | `meta.stats` counts by status |

## Metric availability

| Metric | Status | Note |
|---|---|---|
| Outstanding portfolio / total receivable, active loans, active borrowers | Available | As of today only |
| Loans released, collections, collection efficiency | Available | Previous-period change |
| PAR 30, past due amount | Available | As of today only |
| Aging 1–30 / 31–60 / 61–90 / over 90 | Available | |
| Required loan loss provision | Available | |
| Share capital | Available | Change against the opening balance |
| Net income, income vs expenses for 12 months, cash, assets, equity | Available | Ledger (`accounting:view`) |
| Cash-basis interest, fee and penalty income | Available | |
| Portfolio by product, branch table, officer table | Available | |
| Application pipeline (draft, for review, approved, rejected) | Available | Status counts, not a period |
| New and repeat borrowers, average loan size, pending release | Available | |
| Change on balance metrics, portfolio growth, PAR trend | Needs integration | Needs as-of balances |
| Product, officer and collector filters | Needs integration | Reports take `branch_id` only |
| PAR 1 / 60 / 90, aging 91–180 / 180+ | Needs integration | Fixed buckets server side |
| Recognized interest income by account | Needs integration | Ledger has totals only |
| Application processing times | Unavailable | No status timestamps exposed |
| Insurance collected by period | Unavailable | No period figure |

## Backend handoff (short)

1. **As-of balances.** Add `as_of_date` to `GET /reports/loan-balance-summary` and `/reports/portfolio-by-product`. Rebuild outstanding and overdue from schedules and payments dated on or before that day. This unlocks the change on balance metrics, portfolio growth and the PAR trend.
2. **Filters.** Accept `product_id`, `officer_id` and `collector_id` on the report endpoints above, alongside `branch_id`.
3. **Delinquency buckets.** Add `par_1`, `par_60` and `par_90` to the loan balance summary, and buckets `91_180` and `over_180` to `/reports/aging`.
4. **Recognized interest.** `GET /accounting/dashboard`: add `period.interest_income` (the sum of the interest income accounts for the period).
5. **Processing time.** `GET /reports/application-turnaround?date_from&date_to&branch_id` should return the average and median days from submitted to approved and from approved to released. It needs status-change timestamps.
6. **Insurance.** Add `inflows.repayments.insurance` to `/reports/cash-flow`.
