# Savings & Deposits (Phase 1): backend handoff

The frontend is built behind `NEXT_PUBLIC_ENABLE_SAVINGS`. It is typed against the endpoints below (`src/config/api-endpoints.ts` → `SAVINGS`, types in `src/types/savings.ts`). Until an endpoint answers, its screen shows "Not connected yet" (404/501). Nothing below exists in the backend yet.

## Rules that apply everywhere

- **Money.** `decimal(15,2)`; rates are `decimal(9,6)` as an annual percent. Send money as decimal strings and never use floats.
- **Atomic and locked.** Every balance change runs in one DB transaction with `lockForUpdate()` on the affected account rows. A transfer locks both accounts in id order.
- **Idempotency.** Deposits, withdrawals, transfers, account opening, close and reverse send an `Idempotency-Key` (UUID v4) header.
  - Store it unique per tenant.
  - A replay with the same key returns the first result with no second posting.
- **Ledger.** `savings_transactions` is append-only, with a unique `reference` and `previous_balance` / `running_balance` set server-side.
  - Post double entry through the existing posting engine with `postable_type = savings_transaction`.
- **Reversal** writes an opposite transaction linked by `reversal_of` and never deletes anything.
- **Maker ≠ checker.** Reversals and interest batches can't be approved by the user who created them.
- **Branch scoping** is the same as for loans: a user without `branches:view_all` sees only their branch.
- **Lists** return `meta` with paging and, where noted, `meta.stats` (global per-status counts) or `meta.totals`.
  - `per_page` is at most 100.
  - Report endpoints accept up to 1000.
- **Permissions to seed** for admin and super_admin:
  - `savings:view|create|update|deposit|withdraw|transfer|reverse|approve|post|settings|export`
  - `savings_products:manage`

  Until these are seeded, the frontend keeps them out of the role matrix (`permission-matrix.ts`).

## Endpoints (one line of logic each)

| Method & path | Permission | Logic |
|---|---|---|
| GET `/savings/products` | savings_products:manage or savings:view | Paged list. Filters: `search` (code or name), `status`. `meta.stats` = {active, inactive}. Each row has `accounts_count` and `can_delete` (true only with 0 accounts). |
| POST `/savings/products` · PUT `/savings/products/{id}` | savings_products:manage | `code` is unique per tenant (422). Changing rate, method or posting frequency also needs `savings:settings`; a user without it sends none of the three, so keep the current values on update and default them (0%, daily_balance, monthly) on create. Log every changed field. |
| PATCH `/savings/products/{id}/status` | savings_products:manage | `{status: active\|inactive}`. Inactive blocks new accounts only. |
| DELETE `/savings/products/{id}` | savings_products:manage | 422 if any account was ever opened on it. |
| GET `/savings/products/{id}/history` | savings_products:manage | Change log: action, field, old and new value, user, time. |
| GET · PUT `/savings/settings` | savings:settings | Account-number prefix, include-branch flag and padding; `day_count_basis` 365\|actual; reversal and interest approval toggles; inactive-member opening; dormancy days. |
| GET `/savings/accounts` | savings:view | Paged. Filters: `search` (account number, member name or code), `savings_product_id`, `branch_id`, `status`, `opened_from`/`opened_to`. `meta.stats` = per-status counts plus `total`, ignoring the status filter. Branch-scoped like loans. |
| GET `/savings/accounts/next-number` | savings:create | `?branch_id=` (the member's branch). Preview of the next number from the settings format. The real number is assigned on create. |
| POST `/savings/accounts` | savings:create | Product must be active. Initial deposit ≥ product minimum. One account per member per product unless `allow_multiple_accounts`. Creates the account plus an `opening_deposit` transaction atomically and returns both. |
| GET `/savings/accounts/{id}` · PUT (remarks only) | savings:view / savings:update | Member, product, branch, available and ledger balance, rate, `rate_override`, accrued interest. |
| PATCH `/savings/accounts/{id}/status` | savings:update | `{status, reason}`. Allowed moves: active→frozen\|closed, dormant→active\|frozen, frozen→active. Write a status-history row. |
| GET `/savings/accounts/{id}/closing-quote` · POST `…/close` | savings:update | Quote: `{ledger_balance, accrued_interest, pending_transactions, payout_amount, can_close, blockers[]}`. Close takes `{reason, payment_method}` plus `Idempotency-Key`; it posts the interest, then a `closing_withdrawal` for the full balance, and sets status closed, all in one DB transaction. |
| GET `/savings/accounts/{id}/transactions` | savings:view | Paged, `date_from`/`date_to`. Each row carries the server's `running_balance`. `meta.totals`, `meta.opening_balance` and `meta.closing_balance` for the range. |
| GET `/savings/accounts/{id}/status-history` · `/audit` | savings:view | Status changes and the audit trail. |
| POST `/savings/deposits` | savings:deposit | Refused if the account is closed or frozen, or the product disallows deposits. Returns the transaction with previous and new balance. |
| POST `/savings/withdrawals` | savings:withdraw | Refused if closed, frozen or dormant. amount ≤ available − maintaining balance and ≤ the product's per-withdrawal cap. |
| POST `/savings/transfers` | savings:transfer | Different accounts. Withdrawal rules on the source, deposit rules on the destination. One DB transaction writes `transfer_out` and `transfer_in`. Returns `{reference_number, debit, credit}`, both legs as full transactions. |
| GET `/savings/transactions` · `/{id}` | savings:view | Global history. Filters: account, member, type, status, branch, dates. `meta.totals`. Show returns the receipt payload: `previous_balance`, `running_balance`, `processed_by`, `branch`, `counterparty` (transfer legs), `reversal_of` / `reversed_by` and `pending_reversal {id, reason, requested_by}`. |
| POST `/savings/transactions/{id}/reverse` | savings:reverse | `{reason}` is required. If approval is on, the reversal goes to `pending_approval`; otherwise it posts at once. Not reversible here: interest (reverse the batch), `closing_withdrawal`, a reversal, a reversed row, or one with a reversal already pending. Record `requested_by`. |
| POST `/savings/reversals/{id}/approve\|reject` | savings:approve | Maker ≠ checker: 403 when the approver is the `requested_by` user. Approve posts the reversal; reject takes `{reason}` and records it. |
| POST `/savings/interest/preview` | savings:post | `{product_id?, period_start, period_end}` → per-account rows plus totals. Nothing is saved. |
| POST/GET `/savings/interest/batches` · GET `/{id}` | savings:post | One batch per product per period (unique; 422 on a duplicate). Store the inputs per row: average daily balance, eligible days, rate and basis. |
| POST `/savings/interest/batches/{id}/approve\|reject` | savings:approve | Maker ≠ checker. Only allowed when approval is required. |
| POST `/savings/interest/batches/{id}/post` · `/reverse` | savings:post | Post once: an `interest` transaction per account and its GL entry. Reverse posts opposite entries. A batch can't be posted twice. |
| GET `/savings/dashboard` | savings:view | Total deposits, active accounts, today's deposits and withdrawals, pending approvals. |
| GET `/reports/savings/{register,balances,deposits,withdrawals,transfers,interest-postings,closed-dormant}` | savings:export | Report rows plus server totals; accepts the same filters as the lists. |

## Interest formula

For each day of the period, daily interest = end-of-day balance × rate ÷ 100 ÷ D.

- D is 365. Under `day_count_basis = actual`, D is 366 in a leap year (divisible by 4 and not by 100, or divisible by 400).
- A day whose balance is below `min_balance_to_earn_interest` earns 0.
- Sum the days, then round to the centavo **once**.

## Account number

The format is `{PREFIX}-{BRANCH?}-{SEQUENCE zero-padded}`, for example `SA-01-000001`. Allocate the sequence under a lock and keep it unique per tenant.

## Accounting mapping (needs agreement)

New mapping keys:
- `savings_deposits` (liability; e.g. 2050 Savings Deposits)
- `savings_interest_expense` (e.g. 5xxx Interest Expense on Deposits)
- `savings_interest_payable`

The postings are:
- **Deposit:** Dr Cash / Cr Savings Deposits.
- **Withdrawal:** Dr Savings Deposits / Cr Cash.
- **Interest:** Dr Interest Expense / Cr Savings Deposits.

## Backend tests to write

- **Ledger balance:** the balance equals the sum of the ledger.
- **Withdrawals:**
  - below the maintaining balance → 422;
  - over the cap → 422.
- **Account state:** a frozen or closed account refuses money movement.
- **Replays:** the same Idempotency-Key gives one posting.
- **Concurrency:** two concurrent withdrawals can't overdraw.
- **Transfers:** all or nothing.
- **Reversals:**
  - a reversal never deletes;
  - the maker can't approve their own reversal or batch.
- **Interest batches:**
  - a duplicate batch for the same product and period → 422;
  - posting twice is refused.
- **Interest formula:**
  - leap-year 366 under `actual`;
  - days below the minimum balance earn nothing.
- **Isolation:** branch scoping and tenant isolation on every endpoint.

## Journal source documents

Post savings GL entries with `postable_type = savings_transaction` (`postable_id` = the transaction id, `postable_label` = its reference). Use `savings_account` for postings that belong to the account as a whole. The journal screens link both to `/savings/transactions/{id}` and `/savings/accounts/{id}`.

## Open question

Deposit, withdrawal and transfer screens need `savings:view` to look up the account. If a teller role gets `savings:deposit` without `savings:view`, the screen explains this instead of searching. Either seed `savings:view` alongside, or allow the lookup (`GET /savings/accounts?search=`) for any `savings:deposit|withdraw|transfer` holder.
