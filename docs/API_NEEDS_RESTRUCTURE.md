# Backend Requirements — Loan Restructure Feature

> **Audience:** Backend developer
> **Source:** Frontend spec for the Restructure Loan feature (`/loans/restructure`)
> **Date:** 2026-05-07

---

## Overview

The Restructure feature lets an authorized user take an **active loan** with an outstanding balance and create a **new loan application** from it. The new loan:

- Uses the **outstanding balance** of the source loan as its principal amount
- Has a **new amortization schedule** starting from the restructure date
- Goes through its **own approval workflow** (with a visual indicator that it is a restructure)
- Causes the **source loan** to eventually be marked `restructured` once the new loan is fully released

---

## 1. New Endpoint — Restructure a Loan

### `POST /api/loans/{id}/restructure`

Creates a new loan application derived from the loan at `{id}`.

#### Path parameter
| Param | Type | Description |
|---|---|---|
| `id` | integer | ID of the **source loan** being restructured |

#### Request body
```json
{
  "borrower_id": 12,
  "co_maker_ids": [34, 56],
  "account_officer_id": 7,
  "loan_product_id": 3,
  "principal_amount": 13000.00,
  "interest_rate": 2,
  "start_date": "2026-05-07",
  "scb_amount": 500,
  "purpose": "Business capital"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `borrower_id` | integer | ✅ | Must match the source loan's borrower |
| `co_maker_ids` | integer[] | ❌ | Can be empty array |
| `account_officer_id` | integer | ❌ | |
| `loan_product_id` | integer | ✅ | |
| `principal_amount` | decimal | ✅ | Typically the source loan's outstanding balance, but user-adjustable |
| `interest_rate` | decimal | ✅ | Monthly interest % |
| `start_date` | string (YYYY-MM-DD) | ✅ | The restructure date — this is the new amortization start date |
| `scb_amount` | decimal | ❌ | Share Capital Build-Up per period |
| `purpose` | string | ❌ | |

#### What the backend must do

1. **Validate** that the source loan (`{id}`) has an eligible status: `current`, `past_due`, `released`, or `ongoing`. Reject with 422 if not.
2. **Create a new `Loan` record** with all the provided fields, plus:
   - `source_loan_id` = the source loan's `id`
   - `is_restructure` = `true`
   - `status` = `draft` (enters the normal approval workflow)
3. **Do NOT immediately change** the source loan's status — it remains `current`/`past_due`/etc. until the new loan is fully released (see §3 below).
4. **Return** the newly created loan object (same shape as `GET /api/loans/{id}`).

#### Response — `201 Created`
```json
{
  "id": 99,
  "application_number": "LA-2026-0099",
  "status": "draft",
  "is_restructure": true,
  "source_loan_id": 45,
  "borrower_id": 12,
  "principal_amount": 13000.00,
  "interest_rate": 2,
  "start_date": "2026-05-07",
  ...
}
```

#### Error responses
| Status | Reason |
|---|---|
| 404 | Source loan not found |
| 422 | Source loan status is not eligible for restructure |
| 422 | Validation errors on request body fields |

---

## 2. New Fields on the Loan Model

Add two new columns to the `loans` table:

| Column | Type | Default | Description |
|---|---|---|---|
| `is_restructure` | boolean | `false` | Marks the new loan as a restructure application |
| `source_loan_id` | integer (FK → loans.id) | `null` | Points to the original loan being restructured |

These fields must be:
- Returned on `GET /api/loans` (list) and `GET /api/loans/{id}` (detail)
- Filterable: `GET /api/loans?is_restructure=true`

---

## 3. Status Transition — When to Mark Source Loan as `restructured`

The **source loan's status changes to `restructured`** only when the new restructure loan is **released** (i.e., reaches `released` status in the approval workflow).

State machine:

```
Source loan: current / past_due / released / ongoing
     │
     │ POST /api/loans/{id}/restructure
     ▼
New loan created: status = draft, is_restructure = true
     │
     │ approval workflow: draft → for_review → approved → released
     ▼
New loan: status = released
     │
     │ Backend triggers automatically:
     ▼
Source loan: status = restructured   ← happens HERE
```

**Implementation note:** Hook into the loan release action (`PATCH /api/loans/{id}/release`). When releasing a loan where `is_restructure = true` and `source_loan_id` is set, transition the source loan's status to `restructured`.

---

## 4. Approval Workflow for Restructured Loans

The frontend expects the restructure loan to go through the **same approval states** as a normal loan (`draft → for_review → approved → released`), but to be visually distinguished via `is_restructure = true`.

If you want a **separate approval chain** (different approvers, different thresholds), the backend can:
- Add a `restructure` flag to the workflow configuration
- Route it to different approver roles based on `is_restructure = true`

This is a backend-only decision — the frontend uses the same approval endpoints (`/submit`, `/approve`, `/release`) regardless.

---

## 5. Extend `GET /api/loans/{id}/summary` — No Change Needed

The existing summary endpoint already returns `outstanding_balance`. The frontend uses this when pre-filling the restructure form. No changes required.

---

## 6. Extend Existing List Endpoint

`GET /api/loans` must return `is_restructure` and `source_loan_id` on each loan object so the loans list page can show "Restructured — Current" style badges.

---

## 7. Frontend Endpoint Reference

| Action | Method | Endpoint |
|---|---|---|
| Submit restructure application | `POST` | `/api/loans/{id}/restructure` |
| Auto-forward for review (called immediately after) | `PATCH` | `/api/loans/{newId}/submit` |
| Attach collaterals to new loan | `POST` | `/api/loans/{newId}/collaterals` |
| Get source loan detail | `GET` | `/api/loans/{id}` |
| Get outstanding balance | `GET` | `/api/loans/{id}/summary` |
| Get borrower's loans | `GET` | `/api/loans?borrower_id={id}` |

---

## Summary of Changes Required

| # | Change | Priority |
|---|---|---|
| 1 | Add `POST /api/loans/{id}/restructure` endpoint | 🔴 Required |
| 2 | Add `is_restructure` and `source_loan_id` columns to `loans` table | 🔴 Required |
| 3 | Return `is_restructure` and `source_loan_id` on all loan responses | 🔴 Required |
| 4 | On loan release: if `is_restructure = true`, mark source loan as `restructured` | 🔴 Required |
| 5 | Validate eligible source loan statuses in restructure endpoint | 🔴 Required |
| 6 | (Optional) Separate approval routing for restructured loans | 🟡 Backend decision |
