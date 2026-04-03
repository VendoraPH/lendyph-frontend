# LendyPH API Documentation

> **Base URL:** `https://api-lendyph.abedubas.dev/api`
>
> **Authentication:** Bearer Token (Laravel Sanctum)
>
> **Content-Type:** `application/json`

## Table of Contents

- [Audit Logs](#audit-logs) (2 endpoints)
- [Auth](#auth) (4 endpoints)
- [Borrowers](#borrowers) (9 endpoints)
- [Co-makers](#co-makers) (5 endpoints)
- [Documents](#documents) (6 endpoints)
- [Branches](#branches) (4 endpoints)
- [System](#system) (1 endpoints)
- [Loan Adjustments](#loan-adjustments) (6 endpoints)
- [Loan Products](#loan-products) (5 endpoints)
- [Loans](#loans) (10 endpoints)
- [Amortization Schedule](#amortization-schedule) (2 endpoints)
- [Loan Documents](#loan-documents) (2 endpoints)
- [Repayments](#repayments) (5 endpoints)
- [Reports](#reports) (6 endpoints)
- [Roles](#roles) (2 endpoints)
- [Users](#users) (7 endpoints)

**Total Endpoints: 76**

---

## Audit Logs

**Use Case:** Track all system actions for compliance.

### `GET` `/api/audit-logs`

**List audit logs** | Auth Required

Get paginated audit logs with optional filters

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `user_id` | query | integer | No |
| `action` | query | string | No |
| `auditable_type` | query | string | No |
| `date_from` | query | string (date) | No |
| `date_to` | query | string (date) | No |
| `per_page` | query | integer | No |

**Responses:** `200`, `401`, `403`

---

### `GET` `/api/audit-logs/{id}`

**Show audit log** | Auth Required

Get a specific audit log entry

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`, `404`

---

## Auth

**Use Case:** User authentication, session management, and token refresh.

### `POST` `/api/auth/login`

**Login** | Public

Authenticate with username or email and receive an access token

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `login` | string | Yes |
| `password` | string | Yes |
| `remember` | boolean | No |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/auth/logout`

**Logout** | Auth Required

Revoke the current access token

**Responses:** `200`, `401`

---

### `GET` `/api/auth/me`

**Current user** | Auth Required

Get the authenticated user profile with roles and permissions

**Responses:** `200`, `401`

---

### `POST` `/api/auth/refresh`

**Refresh token** | Auth Required

Revoke current token and issue a new one

**Responses:** `200`, `401`

---

## Borrowers

**Use Case:** CRUD operations for loan borrowers/clients with profile management.

### `GET` `/api/borrowers`

**List borrowers** | Auth Required

Get a paginated list of borrowers with search and filters

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `search` | query | string | No |
| `status` | query | string | No |
| `branch_id` | query | integer | No |
| `per_page` | query | integer | No |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/borrowers`

**Create borrower** | Auth Required

Create a new borrower profile

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | Yes |
| `middle_name` | string | No |
| `last_name` | string | Yes |
| `suffix` | string | No |
| `birthdate` | string (date) | No |
| `civil_status` | string — `single`, `married`, `widowed`, `separated`, `divorced` | No |
| `gender` | string — `male`, `female` | No |
| `address` | string | No |
| `contact_number` | string | No |
| `email` | string | No |
| `employer_or_business` | string | No |
| `monthly_income` | number | No |
| `branch_id` | integer | Yes |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/borrowers/{id}`

**Show borrower** | Auth Required

Get full borrower profile with co-makers and documents

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`, `404`

---

### `PUT` `/api/borrowers/{id}`

**Update borrower** | Auth Required

Update borrower profile

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | No |
| `middle_name` | string | No |
| `last_name` | string | No |
| `suffix` | string | No |
| `birthdate` | string (date) | No |
| `civil_status` | string | No |
| `gender` | string | No |
| `address` | string | No |
| `contact_number` | string | No |
| `email` | string | No |
| `employer_or_business` | string | No |
| `monthly_income` | number | No |
| `branch_id` | integer | No |

**Responses:** `200`, `401`, `403`, `422`

---

### `DELETE` `/api/borrowers/{id}`

**Delete borrower** | Auth Required

Permanently delete a borrower and all related records

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

### `PATCH` `/api/borrowers/{id}/deactivate`

**Deactivate borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/borrowers/{id}/photo`

**Upload borrower photo** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `422`

---

### `DELETE` `/api/borrowers/{id}/photo`

**Delete borrower photo** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`

---

### `PATCH` `/api/borrowers/{id}/reactivate`

**Reactivate borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

## Co-makers

**Use Case:** Manage co-makers (guarantors) linked to borrowers and loans.

### `GET` `/api/borrowers/{borrowerId}/co-makers`

**List co-makers for a borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `borrowerId` | path | integer | Yes |

**Responses:** `200`, `401`, `403`, `404`

---

### `POST` `/api/borrowers/{borrowerId}/co-makers`

**Create co-maker for a borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `borrowerId` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | Yes |
| `middle_name` | string | No |
| `last_name` | string | Yes |
| `suffix` | string | No |
| `address` | string | No |
| `contact_number` | string | No |
| `occupation` | string | No |
| `employer` | string | No |
| `monthly_income` | number | No |
| `relationship_to_borrower` | string | No |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/co-makers/{id}`

**Show co-maker** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `404`

---

### `PUT` `/api/co-makers/{id}`

**Update co-maker** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | No |
| `middle_name` | string | No |
| `last_name` | string | No |
| `suffix` | string | No |
| `address` | string | No |
| `contact_number` | string | No |
| `occupation` | string | No |
| `employer` | string | No |
| `monthly_income` | number | No |
| `relationship_to_borrower` | string | No |
| `status` | string — `active`, `inactive` | No |

**Responses:** `200`, `401`, `403`, `422`

---

### `DELETE` `/api/co-makers/{id}`

**Delete co-maker** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

## Documents

**Use Case:** Upload and manage ID photos, supporting documents.

### `GET` `/api/borrowers/{borrowerId}/documents`

**List borrower documents** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `borrowerId` | path | integer | Yes |

**Responses:** `200`, `401`

---

### `POST` `/api/borrowers/{borrowerId}/documents`

**Upload borrower document** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `borrowerId` | path | integer | Yes |

**Responses:** `201`, `401`, `422`

---

### `GET` `/api/co-makers/{coMakerId}/documents`

**List co-maker documents** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `coMakerId` | path | integer | Yes |

**Responses:** `200`, `401`

---

### `POST` `/api/co-makers/{coMakerId}/documents`

**Upload co-maker document** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `coMakerId` | path | integer | Yes |

**Responses:** `201`, `401`, `422`

---

### `GET` `/api/documents/{id}`

**Show document** | Auth Required

Get document metadata and URL

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `404`

---

### `DELETE` `/api/documents/{id}`

**Delete document** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

## Branches

**Use Case:** Manage lending company branches/offices.

### `GET` `/api/branches`

**List branches** | Auth Required

Get all branches

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `active_only` | query | boolean | No |

**Responses:** `200`, `401`

---

### `POST` `/api/branches`

**Create branch** | Auth Required

Create a new branch

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `code` | string | Yes |
| `address` | string | No |
| `contact_number` | string | No |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/branches/{id}`

**Show branch** | Auth Required

Get a specific branch

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `404`

---

### `PUT` `/api/branches/{id}`

**Update branch** | Auth Required

Update a branch

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | No |
| `code` | string | No |
| `address` | string | No |
| `contact_number` | string | No |
| `is_active` | boolean | No |

**Responses:** `200`, `401`, `403`, `422`

---

## System

**Use Case:** Health monitoring and status checks.

### `GET` `/api/health`

**Health check** | Public

Returns the API health status

**Responses:** `200`

---

## Loan Adjustments

**Use Case:** Adjust loan terms after release — restructure, extend, modify.

### `GET` `/api/loan-adjustments/{loanAdjustment}`

**Show adjustment details** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loanAdjustment` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `PATCH` `/api/loan-adjustments/{loanAdjustment}/apply`

**Apply an approved adjustment to the loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loanAdjustment` | path | integer | Yes |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loan-adjustments/{loanAdjustment}/approve`

**Approve an adjustment** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loanAdjustment` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `remarks` | string | No |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loan-adjustments/{loanAdjustment}/reject`

**Reject an adjustment** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loanAdjustment` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `remarks` | string | No |

**Responses:** `200`, `422`

---

### `GET` `/api/loans/{loan}/adjustments`

**List adjustments for a loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Responses:** `200`

---

### `POST` `/api/loans/{loan}/adjustments`

**Create a loan adjustment** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `adjustment_type` | string — `restructure`, `penalty_waiver`, `balance_adjustment`, `term_extension` | Yes |
| `new_values` | object | Yes |
| `description` | string | No |
| `remarks` | string | No |

**Responses:** `201`, `422`

---

## Loan Products

**Use Case:** Configure loan product templates with rates, terms, fees.

### `GET` `/api/loan-products`

**List loan products** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `search` | query | string | No |
| `status` | query | string | No |

**Responses:** `200`, `401`

---

### `POST` `/api/loan-products`

**Create loan product** | Auth Required

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `interest_rate` | number | Yes |
| `interest_method` | string — `straight`, `diminishing`, `upon_maturity` | Yes |
| `term` | integer | Yes |
| `frequency` | string — `daily`, `weekly`, `semi_monthly`, `monthly` | Yes |
| `processing_fee` | number | No |
| `service_fee` | number | No |
| `penalty_rate` | number | No |
| `grace_period_days` | integer | No |
| `min_amount` | number | No |
| `max_amount` | number | No |

**Responses:** `201`, `422`

---

### `GET` `/api/loan-products/{id}`

**Show loan product** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `PUT` `/api/loan-products/{id}`

**Update loan product** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `422`

---

### `DELETE` `/api/loan-products/{id}`

**Delete loan product** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `409`

---

## Loans

**Use Case:** Full loan lifecycle: application, review, approval, release, voiding.

### `GET` `/api/loans`

**List loans** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `search` | query | string | No |
| `status` | query | string | No |
| `branch_id` | query | integer | No |
| `borrower_id` | query | integer | No |
| `per_page` | query | integer | No |

**Responses:** `200`, `401`

---

### `POST` `/api/loans`

**Create loan application** | Auth Required

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `borrower_id` | integer | Yes |
| `co_maker_ids` | array | No |
| `loan_product_id` | integer | Yes |
| `principal_amount` | number | Yes |
| `interest_rate` | number | No |
| `start_date` | string (date) | Yes |
| `deductions` | array | No |

**Responses:** `201`, `422`

---

### `GET` `/api/loans/{id}`

**Show loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `PUT` `/api/loans/{id}`

**Update loan** | Auth Required

Update loan application (only if draft or for_review)

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `422`

---

### `DELETE` `/api/loans/{id}`

**Delete loan** | Auth Required

Delete loan application (only if draft)

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/approve`

**Approve loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `approval_remarks` | string | No |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/reject`

**Reject loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `approval_remarks` | string | No |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/release`

**Release loan** | Auth Required

Release an approved loan — generates loan account number and amortization schedule

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/submit`

**Submit loan for review** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/void`

**Void loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `422`

---

## Amortization Schedule

### `GET` `/api/loans/{id}/amortization-preview`

**Preview amortization schedule** | Auth Required

Compute and return amortization schedule without persisting

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `GET` `/api/loans/{id}/amortization-schedule`

**View persisted amortization schedule with payment tracking** | Auth Required

Returns the saved amortization schedule with beginning balance, paid amounts, penalties, and status per installment. Includes summary totals.

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `404`, `422`

---

## Loan Documents

### `GET` `/api/loans/{loan}/disclosure`

**Generate disclosure statement** | Auth Required

Returns all financial terms, deductions, and amortization schedule for printing/display

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Responses:** `200`, `422`, `404`

---

### `GET` `/api/loans/{loan}/promissory-note`

**Generate promissory note** | Auth Required

Returns borrower promise-to-pay data, co-maker details, loan terms, and signature fields

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Responses:** `200`, `422`, `404`

---

## Repayments

**Use Case:** Record and manage borrower loan repayments.

### `GET` `/api/loans/{loan}/repayments`

**List repayments for a loan** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |
| `per_page` | query | integer | No |

**Responses:** `200`, `401`, `404`

---

### `POST` `/api/loans/{loan}/repayments`

**Record a repayment** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `payment_date` | string (date) | Yes |
| `amount_paid` | number | Yes |
| `remarks` | string | No |

**Responses:** `201`, `422`

---

### `GET` `/api/loans/{loan}/summary`

**Loan balance summary** | Auth Required

Returns outstanding balance, overdue amounts, next due date, and payment totals

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `GET` `/api/repayments/{repayment}`

**Show repayment / receipt details** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `repayment` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `PATCH` `/api/repayments/{repayment}/void`

**Void a repayment** | Auth Required

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `repayment` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `void_reason` | string | Yes |

**Responses:** `200`, `422`

---

## Reports

**Use Case:** Generate business reports — releases, repayments, balances, ledgers.

### `GET` `/api/reports/due-past-due`

**List of Due / Past Due** | Auth Required

Schedules that are due or overdue as of today

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `date_from` | query | string (date) | No |
| `date_to` | query | string (date) | No |
| `branch_id` | query | integer | No |
| `per_page` | query | integer | No |

**Responses:** `200`

---

### `GET` `/api/reports/loan-balance-summary`

**Loan Balance Summary** | Auth Required

Aggregate portfolio, outstanding, and overdue amounts by branch

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `date_from` | query | string (date) | No |
| `date_to` | query | string (date) | No |
| `branch_id` | query | integer | No |

**Responses:** `200`

---

### `GET` `/api/reports/releases`

**List of Releases** | Auth Required

Paginated list of released loans with filters

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `date_from` | query | string (date) | No |
| `date_to` | query | string (date) | No |
| `branch_id` | query | integer | No |
| `status` | query | string | No |
| `per_page` | query | integer | No |

**Responses:** `200`

---

### `GET` `/api/reports/repayments`

**List of Repayments** | Auth Required

Paginated list of repayments with filters

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `date_from` | query | string (date) | No |
| `date_to` | query | string (date) | No |
| `branch_id` | query | integer | No |
| `loan_id` | query | integer | No |
| `status` | query | string | No |
| `per_page` | query | integer | No |

**Responses:** `200`

---

### `GET` `/api/reports/statement-of-account/{loan}`

**Statement of Account** | Auth Required

All transactions, schedule, and balance for a specific loan

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `loan` | path | integer | Yes |

**Responses:** `200`, `404`

---

### `GET` `/api/reports/subsidiary-ledger/{borrower}`

**Subsidiary Ledger** | Auth Required

All loans with balances and payment history for a borrower

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `borrower` | path | integer | Yes |
| `date_from` | query | string (date) | No |
| `date_to` | query | string (date) | No |

**Responses:** `200`, `404`

---

## Roles

**Use Case:** View available roles and their permissions for RBAC.

### `GET` `/api/roles`

**List roles** | Auth Required

Get all roles with their permissions

**Responses:** `200`, `401`, `403`

---

### `GET` `/api/roles/{id}`

**Show role** | Auth Required

Get a specific role with permissions

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`, `404`

---

## Users

**Use Case:** Manage internal staff accounts (loan officers, cashiers, collectors, admins).

### `GET` `/api/users`

**List users** | Auth Required

Get a paginated list of all users

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `search` | query | string | No |
| `status` | query | string | No |
| `branch_id` | query | integer | No |
| `role` | query | string | No |
| `per_page` | query | integer | No |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/users`

**Create user** | Auth Required

Create a new user account

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | Yes |
| `last_name` | string | Yes |
| `username` | string | Yes |
| `email` | string | Yes |
| `mobile_number` | string | No |
| `password` | string | Yes |
| `password_confirmation` | string | Yes |
| `branch_id` | integer | Yes |
| `role` | string | Yes |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/users/{id}`

**Show user** | Auth Required

Get a specific user by ID

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`, `404`

---

### `PUT` `/api/users/{id}`

**Update user** | Auth Required

Update an existing user

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | No |
| `last_name` | string | No |
| `username` | string | No |
| `email` | string | No |
| `mobile_number` | string | No |
| `branch_id` | integer | No |
| `role` | string | No |

**Responses:** `200`, `401`, `403`, `404`, `422`

---

### `PATCH` `/api/users/{id}/deactivate`

**Deactivate user** | Auth Required

Deactivate a user account

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

### `PATCH` `/api/users/{id}/reactivate`

**Reactivate user** | Auth Required

Reactivate a deactivated user account

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/users/{id}/reset-password`

**Reset user password** | Auth Required

Reset a user password (admin action)

**Parameters:**

| Name | In | Type | Required |
|------|----|------|----------|
| `id` | path | integer | Yes |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `password` | string | Yes |
| `password_confirmation` | string | Yes |

**Responses:** `200`, `401`, `403`, `422`

---

## Endpoint Summary

| Tag | Count |
|-----|-------|
| Audit Logs | 2 |
| Auth | 4 |
| Borrowers | 9 |
| Co-makers | 5 |
| Documents | 6 |
| Branches | 4 |
| System | 1 |
| Loan Adjustments | 6 |
| Loan Products | 5 |
| Loans | 10 |
| Amortization Schedule | 2 |
| Loan Documents | 2 |
| Repayments | 5 |
| Reports | 6 |
| Roles | 2 |
| Users | 7 |
| **Total** | **76** |