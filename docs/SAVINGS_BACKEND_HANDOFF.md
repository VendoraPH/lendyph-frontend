# Savings & Deposits: backend handoff (Parts 1–2: products, accounts, transactions, time deposits)

Built frontend-only behind `NEXT_PUBLIC_ENABLE_SAVINGS` (off by default). The
Swagger at `api-lendyph.abedubas.dev` was unreachable (404) when this was
written, so **none of this is verified against the backend**. Every screen shows
"Not connected yet" on a 404/501, so it is safe to ship the routes in stages.

Types: `src/types/savings.ts`. Paths: `API_ENDPOINTS.SAVINGS`. Service:
`src/services/savings.service.ts`.

## Permissions

Seed `savings:view`, `savings:create`, `savings:transact`, `savings:close` and
`savings:settings` (admin and super_admin by default). The roles screen does not
offer them yet (`permission-matrix.ts` excludes `savings`); remove that
exclusion once they are seeded.

## Endpoints

All responses use the usual `{ success, data }` envelope. Lists keep `meta`.
Money is `decimal:2`. Dates are `YYYY-MM-DD` in Asia/Manila.

| Endpoint | Permission | Logic |
| --- | --- | --- |
| `GET /savings/products` | `savings:view` | Every product (not paged), with `account_count` (open accounts). |
| `POST /savings/products`, `PUT /savings/products/{id}` | `savings:settings` | Validate rate 0–100, balances ≥ 0, `dormant_after_days` ≥ 1 or null, unique `code`. Changes apply to future postings only. |
| `DELETE /savings/products/{id}` | `savings:settings` | 422 while the product has any account; deactivate it (`is_active: false`) instead. |
| `GET /savings/accounts` | `savings:view` | Paged (`per_page` ≤ 100). Filters: `search` (account no., member name or code), `status`, `product_id`, `branch_id`, `borrower_id`. Branch-scoped unless `branches:view_all`. `meta.stats` = accounts per status over the whole visible book; `meta.totals` = `{account_count, total_balance}` over the rows matching the filters. |
| `GET /savings/accounts/{id}` | `savings:view` | One account with `product`, `balance`, `hold_amount`, `available_balance`, `accrued_interest`. |
| `POST /savings/accounts` | `savings:create` | Open: `borrower_id`, `product_id`, `opened_at`, `initial_deposit`, `payment_method`, `reference?`. Product must be active and `regular`; deposit ≥ `minimum_opening_balance`. Generate `account_number`, post the opening deposit as the first transaction, and journal it (Dr cash/bank, Cr savings deposits liability). |
| `GET /savings/accounts/{id}/transactions` | `savings:view` | Paged, newest first. Each row has `debit`/`credit` (one is 0), `running_balance` in posting order (date, then id) whatever the page, `type`, `created_by_user`. Filters: `date_from`, `date_to`, `type`. |
| `POST /savings/accounts/{id}/deposits` | `savings:transact` | `amount`, `date`, `payment_method`, `reference?`, `remarks?`. Allowed on active and dormant accounts; a deposit reactivates a dormant one. Journal it. |
| `POST /savings/accounts/{id}/withdrawals` | `savings:transact` | Same fields. Active accounts only. 422 when `amount` > `available_balance`. Journal it. |
| `POST /savings/accounts/{id}/close` | `savings:close` | `date`, `reason`, `payout_method`. 422 if there are holds or the account is closed. Credit accrued interest (less withholding tax), apply any closing fee, pay out the rest as a `closing` line, then set `status: closed` and `closed_at`. |

## Server-side rules

- `available_balance` = `balance` − `hold_amount` − the product's `maintaining_balance`, never below 0.
- Interest accrues daily on the closing balance when it is at least `minimum_balance_for_interest`, and is credited on the product's `interest_posting` schedule as an `interest` line, with a `withholding_tax` line for the tax.
- An account with no member transaction for `dormant_after_days` turns `dormant`. Interest postings do not count as activity.
- `frozen` is set by staff or by a hold order; it blocks withdrawals and deposits. (No screen sets it yet.)

## Part 2: time deposits

### Product fields (both kinds)

- `withholding_tax_rate`: percent 0–100 on interest (0 where members are exempt). Applies to regular-savings interest postings too.
- `term_options_days`: `int[]`, required and non-empty for `kind: time_deposit`, null for `regular`.
- `pretermination_rate`: percent per year, 0 up to `annual_interest_rate`, for `time_deposit` only.
- `kind` cannot change after create (422). One rate per TD product; a coop with rates by term makes one product per term.

### Endpoints

| Endpoint | Permission | Logic |
| --- | --- | --- |
| `GET /savings/time-deposits` | `savings:view` | Paged (`per_page` ≤ 100). Filters: `search` (certificate no., member name or code), `status`, `borrower_id`, `product_id`. Branch-scoped. `meta.stats` = placements per status over the visible book; `meta.totals` = `{count, total_principal, maturing_30_days}` over the matching rows (`maturing_30_days` counts active ones). |
| `GET /savings/time-deposits/{id}` | `savings:view` | One placement, with `product`, member and branch names, `created_by_user`, rollover links. |
| `POST /savings/time-deposits` | `savings:create` | Place: `borrower_id`, `product_id`, `principal`, `term_days`, `placement_date`, `maturity_instruction` (`payout`/`rollover_principal`/`rollover_all`), `payment_method`, `reference?`. Product active and `time_deposit`; `term_days` in its `term_options_days`; principal ≥ `minimum_opening_balance`. Copy the rates onto the placement, set `maturity_date` = placement + term, compute `gross_interest`, `withholding_tax`, `net_interest`, `maturity_amount`, generate `certificate_number`, and journal it (Dr cash/bank, Cr time deposits liability). |
| `POST /savings/time-deposits/{id}/settle` | `savings:transact` | `date` (≥ `maturity_date`), `action`, `payout_method`. `payout`: pay principal + net interest, status `withdrawn`. `rollover_principal`: pay net interest, new placement of the principal. `rollover_all`: new placement of the maturity amount. A rollover uses the same product and term at the product's **current** rate, sets `rolled_over_to_id`/`rolled_over_from_id`, status `rolled_over`, and **returns the new placement** (the UI follows it). Set `settled_at`, `settled_amount`. Journal interest expense, tax payable and the payout. |
| `GET /savings/time-deposits/{id}/pretermination-quote?date=` | `savings:view` | What breaking it on `date` pays: `{date, days_held, rate, gross_interest, withholding_tax, penalty, payout}` at the placement's `pretermination_rate`. No side effects. |
| `POST /savings/time-deposits/{id}/preterminate` | `savings:close` | `date` (before maturity), `reason`, `payout_method`. Same figures as the quote; status `preterminated`, `settled_at`, `settled_amount`. Journal it. |

### Server-side rules

- The server computes all interest. The UI estimates on a **360-day year** (`principal × rate × days / 360`); confirm the basis (360 vs 365) and we will match it.
- A nightly job turns `active` placements whose `maturity_date` has passed into `matured`.
- `DELETE /savings/products/{id}` stays 422 while a product has any placement.
- The certificate is printed client-side from the placement; `certificate_number` must be unique and stable, because reprints quote it.

## Coming in later parts

Holds, passbook printing, savings reports and accounting views, and approving
Member Portal withdrawal and opening requests.
