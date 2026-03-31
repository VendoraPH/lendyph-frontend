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
- [Loan Products](#loan-products) (5 endpoints)
- [Loans](#loans) (11 endpoints)
- [Roles](#roles) (2 endpoints)
- [Users](#users) (7 endpoints)

---

## Audit Logs

**Use Case:** Track all system actions for compliance and accountability.

### `GET` `/api/audit-logs`

**List audit logs** | Auth Required

Get paginated audit logs with optional filters

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `user_id` | query | integer | No | - |
| `action` | query | string | No | - |
| `auditable_type` | query | string | No | - |
| `date_from` | query | string (date) | No | - |
| `date_to` | query | string (date) | No | - |
| `per_page` | query | integer | No | 15 |

**Responses:** `200`, `401`, `403`

---

### `GET` `/api/audit-logs/{id}`

**Show audit log** | Auth Required

Get a specific audit log entry

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`, `404`

---

## Auth

**Use Case:** User authentication, session management, and token refresh for the lending platform.

### `POST` `/api/auth/login`

**Login** | Public

Authenticate with username or email and receive an access token

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `login` | string | Yes | admin |
| `password` | string | Yes | password |
| `remember` | boolean | No | - |

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

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `search` | query | string | No | - |
| `status` | query | string | No | - |
| `branch_id` | query | integer | No | - |
| `per_page` | query | integer | No | 15 |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/borrowers`

**Create borrower** | Auth Required

Create a new borrower profile

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `first_name` | string | Yes | Juan |
| `middle_name` | string | No | Santos |
| `last_name` | string | Yes | Dela Cruz |
| `suffix` | string | No | Jr. |
| `birthdate` | string (date) | No | 1990-01-15 |
| `civil_status` | string | No | `single`, `married`, `widowed`, `separated`, `divorced` |
| `gender` | string | No | `male`, `female` |
| `address` | string | No | - |
| `contact_number` | string | No | 09171234567 |
| `email` | string | No | juan@email.com |
| `employer_or_business` | string | No | - |
| `monthly_income` | number | No | 25000 |
| `branch_id` | integer | Yes | 1 |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/borrowers/{id}`

**Show borrower** | Auth Required

Get full borrower profile with co-makers and documents

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`, `404`

---

### `PUT` `/api/borrowers/{id}`

**Update borrower** | Auth Required

Update borrower profile

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `first_name` | string | No | - |
| `middle_name` | string | No | - |
| `last_name` | string | No | - |
| `suffix` | string | No | - |
| `birthdate` | string (date) | No | - |
| `civil_status` | string | No | - |
| `gender` | string | No | - |
| `address` | string | No | - |
| `contact_number` | string | No | - |
| `email` | string | No | - |
| `employer_or_business` | string | No | - |
| `monthly_income` | number | No | - |
| `branch_id` | integer | No | - |

**Responses:** `200`, `401`, `403`, `422`

---

### `DELETE` `/api/borrowers/{id}`

**Delete borrower** | Auth Required

Permanently delete a borrower and all related records

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

### `PATCH` `/api/borrowers/{id}/deactivate`

**Deactivate borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/borrowers/{id}/photo`

**Upload borrower photo** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `photo` | string (binary) | Yes | - |

**Responses:** `200`, `401`, `422`

---

### `DELETE` `/api/borrowers/{id}/photo`

**Delete borrower photo** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`

---

### `PATCH` `/api/borrowers/{id}/reactivate`

**Reactivate borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

## Co-makers

**Use Case:** Manage co-makers (guarantors) linked to borrowers and their loan applications.

### `GET` `/api/borrowers/{borrowerId}/co-makers`

**List co-makers for a borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `borrowerId` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`, `404`

---

### `POST` `/api/borrowers/{borrowerId}/co-makers`

**Create co-maker for a borrower** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `borrowerId` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `first_name` | string | Yes | Maria |
| `middle_name` | string | No | - |
| `last_name` | string | Yes | Santos |
| `suffix` | string | No | - |
| `address` | string | No | - |
| `contact_number` | string | No | 09181234567 |
| `occupation` | string | No | - |
| `employer` | string | No | - |
| `monthly_income` | number | No | 20000 |
| `relationship_to_borrower` | string | No | Spouse |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/co-makers/{id}`

**Show co-maker** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `404`

---

### `PUT` `/api/co-makers/{id}`

**Update co-maker** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `first_name` | string | No | - |
| `middle_name` | string | No | - |
| `last_name` | string | No | - |
| `suffix` | string | No | - |
| `address` | string | No | - |
| `contact_number` | string | No | - |
| `occupation` | string | No | - |
| `employer` | string | No | - |
| `monthly_income` | number | No | - |
| `relationship_to_borrower` | string | No | - |
| `status` | string | No | `active`, `inactive` |

**Responses:** `200`, `401`, `403`, `422`

---

### `DELETE` `/api/co-makers/{id}`

**Delete co-maker** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

## Documents

**Use Case:** Upload and manage ID photos, supporting documents for borrowers and co-makers.

### `GET` `/api/borrowers/{borrowerId}/documents`

**List borrower documents** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `borrowerId` | path | integer | Yes | - |

**Responses:** `200`, `401`

---

### `POST` `/api/borrowers/{borrowerId}/documents`

**Upload borrower document** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `borrowerId` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `file` | string (binary) | Yes | - |
| `type` | string | Yes | valid_id |
| `label` | string | No | PhilID Front |

**Responses:** `201`, `401`, `422`

---

### `GET` `/api/co-makers/{coMakerId}/documents`

**List co-maker documents** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `coMakerId` | path | integer | Yes | - |

**Responses:** `200`, `401`

---

### `POST` `/api/co-makers/{coMakerId}/documents`

**Upload co-maker document** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `coMakerId` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `file` | string (binary) | Yes | - |
| `type` | string | Yes | valid_id |
| `label` | string | No | PhilID Front |

**Responses:** `201`, `401`, `422`

---

### `GET` `/api/documents/{id}`

**Show document** | Auth Required

Get document metadata and URL

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `404`

---

### `DELETE` `/api/documents/{id}`

**Delete document** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

## Branches

**Use Case:** Manage lending company branches/offices.

### `GET` `/api/branches`

**List branches** | Auth Required

Get all branches

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `active_only` | query | boolean | No | - |

**Responses:** `200`, `401`

---

### `POST` `/api/branches`

**Create branch** | Auth Required

Create a new branch

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `name` | string | Yes | Butuan Branch |
| `code` | string | Yes | BTN |
| `address` | string | No | 123 Main St, Butuan City |
| `contact_number` | string | No | 09171234567 |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/branches/{id}`

**Show branch** | Auth Required

Get a specific branch

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `404`

---

### `PUT` `/api/branches/{id}`

**Update branch** | Auth Required

Update a branch

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `name` | string | No | - |
| `code` | string | No | - |
| `address` | string | No | - |
| `contact_number` | string | No | - |
| `is_active` | boolean | No | - |

**Responses:** `200`, `401`, `403`, `422`

---

## System

**Use Case:** System health monitoring and status checks.

### `GET` `/api/health`

**Health check** | Public

Returns the API health status

**Responses:** `200`

---

## Loan Products

**Use Case:** Configure loan product templates with interest rates, terms, fees, and penalties.

### `GET` `/api/loan-products`

**List loan products** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `search` | query | string | No | - |
| `status` | query | string | No | - |

**Responses:** `200`, `401`

---

### `POST` `/api/loan-products`

**Create loan product** | Auth Required

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `name` | string | Yes | Personal Loan - 12 Months |
| `interest_rate` | number | Yes | 3 |
| `interest_method` | string | Yes | `straight`, `diminishing`, `upon_maturity` |
| `term` | integer | Yes | 12 |
| `frequency` | string | Yes | `daily`, `weekly`, `semi_monthly`, `monthly` |
| `processing_fee` | number | No | 2 |
| `service_fee` | number | No | 1 |
| `penalty_rate` | number | No | 3 |
| `grace_period_days` | integer | No | 3 |
| `min_amount` | number | No | 5000 |
| `max_amount` | number | No | 500000 |

**Responses:** `201`, `422`

---

### `GET` `/api/loan-products/{id}`

**Show loan product** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `404`

---

### `PUT` `/api/loan-products/{id}`

**Update loan product** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `422`

---

### `DELETE` `/api/loan-products/{id}`

**Delete loan product** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `409`

---

## Loans

**Use Case:** Full loan lifecycle: application, review, approval, rejection, release, and voiding.

### `GET` `/api/loans`

**List loans** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `search` | query | string | No | - |
| `status` | query | string | No | - |
| `branch_id` | query | integer | No | - |
| `borrower_id` | query | integer | No | - |
| `per_page` | query | integer | No | 15 |

**Responses:** `200`, `401`

---

### `POST` `/api/loans`

**Create loan application** | Auth Required

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `borrower_id` | integer | Yes | 1 |
| `co_maker_ids` | array | No | [1] |
| `loan_product_id` | integer | Yes | 1 |
| `principal_amount` | number | Yes | 50000 |
| `interest_rate` | number | No | 3 |
| `start_date` | string (date) | Yes | 2026-04-01 |
| `deductions` | array | No | - |

**Responses:** `201`, `422`

---

### `GET` `/api/loans/{id}`

**Show loan** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `404`

---

### `PUT` `/api/loans/{id}`

**Update loan** | Auth Required

Update loan application (only if draft or for_review)

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `422`

---

### `DELETE` `/api/loans/{id}`

**Delete loan** | Auth Required

Delete loan application (only if draft)

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `422`

---

### `GET` `/api/loans/{id}/amortization-preview`

**Preview amortization schedule** | Auth Required

Compute and return amortization schedule without persisting

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `404`

---

### `PATCH` `/api/loans/{id}/approve`

**Approve loan** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `approval_remarks` | string | No | - |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/reject`

**Reject loan** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `approval_remarks` | string | No | - |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/release`

**Release loan** | Auth Required

Release an approved loan — generates loan account number and amortization schedule

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/submit`

**Submit loan for review** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `422`

---

### `PATCH` `/api/loans/{id}/void`

**Void loan** | Auth Required

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `422`

---

## Roles

**Use Case:** View available roles and their permissions for role-based access control.

### `GET` `/api/roles`

**List roles** | Auth Required

Get all roles with their permissions

**Responses:** `200`, `401`, `403`

---

### `GET` `/api/roles/{id}`

**Show role** | Auth Required

Get a specific role with permissions

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`, `404`

---

## Users

**Use Case:** Manage internal staff accounts (loan officers, cashiers, collectors, admins).

### `GET` `/api/users`

**List users** | Auth Required

Get a paginated list of all users

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `search` | query | string | No | - |
| `status` | query | string | No | - |
| `branch_id` | query | integer | No | - |
| `role` | query | string | No | - |
| `per_page` | query | integer | No | 15 |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/users`

**Create user** | Auth Required

Create a new user account

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `first_name` | string | Yes | John |
| `last_name` | string | Yes | Doe |
| `username` | string | Yes | johndoe |
| `email` | string | Yes | john@lendyph.com |
| `mobile_number` | string | No | 09171234567 |
| `password` | string | Yes | password123 |
| `password_confirmation` | string | Yes | password123 |
| `branch_id` | integer | Yes | 1 |
| `role` | string | Yes | loan-officer |

**Responses:** `201`, `401`, `403`, `422`

---

### `GET` `/api/users/{id}`

**Show user** | Auth Required

Get a specific user by ID

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`, `404`

---

### `PUT` `/api/users/{id}`

**Update user** | Auth Required

Update an existing user

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `first_name` | string | No | - |
| `last_name` | string | No | - |
| `username` | string | No | - |
| `email` | string | No | - |
| `mobile_number` | string | No | - |
| `branch_id` | integer | No | - |
| `role` | string | No | - |

**Responses:** `200`, `401`, `403`, `404`, `422`

---

### `PATCH` `/api/users/{id}/deactivate`

**Deactivate user** | Auth Required

Deactivate a user account

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

### `PATCH` `/api/users/{id}/reactivate`

**Reactivate user** | Auth Required

Reactivate a deactivated user account

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Responses:** `200`, `401`, `403`

---

### `POST` `/api/users/{id}/reset-password`

**Reset user password** | Auth Required

Reset a user password (admin action)

**Parameters:**

| Name | In | Type | Required | Default |
|------|----|------|----------|---------|
| `id` | path | integer | Yes | - |

**Request Body:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `password` | string | Yes | newpassword123 |
| `password_confirmation` | string | Yes | newpassword123 |

**Responses:** `200`, `401`, `403`, `422`

---

## Frontend Integration Mapping

| API Endpoint | Frontend Page | Current Service |
|---|---|---|
| `POST /api/auth/login` | `/login` | `auth.service.ts` |
| `POST /api/auth/logout` | Header logout | `auth.service.ts` |
| `GET /api/auth/me` | Layout (auth guard) | `auth.service.ts` |
| `POST /api/auth/refresh` | Axios interceptor | `auth.service.ts` |
| `GET /api/users` | `/users` (Team) | `user.service.ts` |
| `POST /api/users` | `/users` Add User dialog | `user.service.ts` |
| `PUT /api/users/{id}` | `/users` Edit dialog | `user.service.ts` |
| `GET /api/borrowers` | `/borrowers` | `borrower.service.ts` |
| `POST /api/borrowers` | `/borrowers` Add dialog | `borrower.service.ts` |
| `GET /api/borrowers/{id}` | `/borrowers/[id]` | `borrower.service.ts` |
| `PUT /api/borrowers/{id}` | `/borrowers/[id]` Edit | `borrower.service.ts` |
| `PATCH /api/borrowers/{id}/deactivate` | `/borrowers` Toggle status | `borrower.service.ts` |
| `PATCH /api/borrowers/{id}/reactivate` | `/borrowers` Toggle status | `borrower.service.ts` |
| `POST /api/borrowers/{id}/photo` | `/borrowers` Photo upload | `borrower.service.ts` |
| `GET /api/borrowers/{id}/co-makers` | `/borrowers/[id]` Co-Makers tab | New service needed |
| `POST /api/borrowers/{id}/co-makers` | `/borrowers/[id]` Add Co-Maker | New service needed |
| `PUT /api/co-makers/{id}` | `/borrowers/[id]` Edit Co-Maker | New service needed |
| `DELETE /api/co-makers/{id}` | `/borrowers/[id]` Delete Co-Maker | New service needed |
| `GET /api/loan-products` | `/loans/products` | New service needed |
| `POST /api/loan-products` | `/loans/products` Add | New service needed |
| `PUT /api/loan-products/{id}` | `/loans/products` Edit | New service needed |
| `DELETE /api/loan-products/{id}` | `/loans/products` Delete | New service needed |
| `GET /api/loans` | `/loans` | `loan.service.ts` |
| `POST /api/loans` | `/loans/new` | `loan.service.ts` |
| `GET /api/loans/{id}` | `/loans/[id]` | `loan.service.ts` |
| `PATCH /api/loans/{id}/submit` | `/loans/[id]` Submit for Review | `loan.service.ts` |
| `PATCH /api/loans/{id}/approve` | `/loans/[id]` Approve | `loan.service.ts` |
| `PATCH /api/loans/{id}/reject` | `/loans/[id]` Reject | `loan.service.ts` |
| `PATCH /api/loans/{id}/release` | `/loans/[id]` Release | `loan.service.ts` |
| `PATCH /api/loans/{id}/void` | `/loans/[id]` Void | `loan.service.ts` |
| `GET /api/loans/{id}/amortization-preview` | `/loans/[id]` Schedule | `loan.service.ts` |
| `GET /api/audit-logs` | `/audit-trail` | `audit.service.ts` |
| `GET /api/branches` | Profile / Settings | New service needed |
| `GET /api/roles` | Team management | New service needed |
| `GET /api/documents/{id}` | Document viewer | New service needed |
| `GET /api/health` | System monitoring | Not mapped |

## Environment Setup

Update `.env.local` with the API URL:

```env
NEXT_PUBLIC_API_URL=https://api-lendyph.abedubas.dev/api
NEXT_PUBLIC_STORAGE_URL=https://api-lendyph.abedubas.dev/storage
```

## API Endpoint Summary

**Total Endpoints:** 56

| Tag | Count |
|-----|-------|
| Audit Logs | 2 |
| Auth | 4 |
| Borrowers | 9 |
| Co-makers | 5 |
| Documents | 6 |
| Branches | 4 |
| System | 1 |
| Loan Products | 5 |
| Loans | 11 |
| Roles | 2 |
| Users | 7 |