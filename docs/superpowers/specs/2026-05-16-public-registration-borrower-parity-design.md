# Public Registration ↔ Admin Borrower Parity

**Date:** 2026-05-16
**Branch:** feat/online-member-registration
**Status:** Approved — implementation in progress

## Goal

The public `/register` form should collect the same field set as the admin `/borrowers/new` form, submit through the same backend resource, and create a `status=pending` row that admin reviews via `/borrowers/registrations/[id]` and activates via the existing approve action.

## Scope

- Expand `/register` from 3 to 5 wizard steps to cover the full borrower field set.
- Add a public Branch picker (replaces admin's auto-assign from logged-in user).
- Add photo upload, valid ID uploads, spouse info, and employment/income.
- Reuse admin's photo-crop and id-crop dialogs (lift to a shared module).
- After admin approves, an active borrower exists — no migration of pending data needed.

## Wizard structure

| Step | Title | Fields |
|---|---|---|
| 1 | Personal Info | first_name, middle_name, last_name, suffix, birthdate, gender, civil_status, **branch_id** |
| 2 | Contact & Address | contact_number, email, address, barangay, city, province |
| 3 | Spouse Info (auto-skipped when not married) | spouse_first_name, spouse_middle_name, spouse_last_name, spouse_contact_number, spouse_occupation |
| 4 | Photo & Valid IDs | profile photo, valid IDs array |
| 5 | Employment & Review | employer_or_business, monthly_income, pledge_amount, review summary |

## Submission flow

```
1. POST /borrowers   (status=pending, full payload, no auth)
     → { id, submission_token, expires_at }
2. POST /borrowers/{id}/photo        (multipart, X-Submission-Token header)   if photo
3. POST /borrowers/{id}/valid-ids    (multipart, X-Submission-Token header)   per ID
4. Navigate to /register/success
```

Partial-upload failure policy: if step 1 succeeds and 2 or 3 partially fail, navigate to success and toast a non-blocking warning. The pending row still exists; admin can request re-upload during review.

## Public payload contract

```ts
// POST /borrowers
{
  status: "pending",
  branch_id: number,
  first_name: string,
  middle_name: string,
  last_name: string,
  suffix?: string,
  birthdate: string,            // YYYY-MM-DD
  gender: "male" | "female",
  civil_status: "single" | "married" | "widowed" | "separated" | "divorced",
  contact_number: string,
  email?: string,
  address: string,
  barangay?: string,
  city: string,
  province: string,
  employer_or_business?: string,
  monthly_income?: number,
  pledge_amount?: number,       // default 0
  spouse_first_name?: string,
  spouse_middle_name?: string,
  spouse_last_name?: string,
  spouse_contact_number?: string,
  spouse_occupation?: string,
}

// Response 201
{
  id: number,
  submission_token: string,     // opaque, ~15 min TTL
  expires_at: string,           // ISO timestamp
}
```

## Backend requirements

| # | Endpoint | Today | Required change |
|---|---|---|---|
| 1 | `POST /borrowers` | Auth required | Allow unauthenticated when `status="pending"` and required fields present. Reject anonymous requests for any other status. |
| 2 | `POST /borrowers` (response) | `{ id }` | Add `submission_token` (string) and `expires_at` (ISO timestamp). TTL ~15 min. Token must be bound to the new borrower id. |
| 3 | `POST /borrowers/{id}/photo` | Auth required | Accept `X-Submission-Token` header as an alternative to auth. Token must match the borrower id and be unexpired. |
| 4 | `POST /borrowers/{id}/valid-ids` | Auth required | Same `X-Submission-Token` accommodation. Multipart fields: `type`, `custom_type_name?`, `id_number?`, `front_file?`, `back_file?`. |
| 5 | `GET /branches/public` (NEW) | Does not exist | Return `[{ id: number, name: string, city?: string }]`. No auth. No internal fields. |
| 6 | Rate limiting | — | Apply per-IP rate limiting to `POST /borrowers` (pending) and the two media upload endpoints to prevent abuse. |

Approve (`POST /borrowers/{id}/reactivate`) and Reject (`DELETE /borrowers/{id}`) flows are unchanged.

## Validation (per step)

- **Step 1:** first_name, middle_name, last_name, birthdate, gender, civil_status, branch_id required.
- **Step 2:** contact_number, address, city, province required. Email optional, but format-validated when present.
- **Step 3:** when married → spouse_first_name + spouse_last_name required; other spouse fields optional. Step skipped entirely when not married.
- **Step 4:** no required fields. Valid ID rows with `type="others"` require `custom_type_name`.
- **Step 5:** monthly_income, pledge_amount non-negative when present.

## Files

```
src/app/(public)/register/
  page.tsx                              # rewrite to 5-step orchestrator
  _components/
    step-indicator.tsx                  # exists, accepts 5 labels
    step-personal.tsx                   # add branch picker
    step-contact.tsx                    # unchanged
    step-spouse.tsx                     # NEW
    step-photo-ids.tsx                  # NEW
    step-employment-review.tsx          # NEW
    step-review.tsx                     # repurpose into step-employment-review, or delete

src/services/registration.service.ts    # expand payload type, add uploadPhoto / uploadValidId calls, surface submission_token
src/hooks/use-public-branches.ts        # NEW (GET /branches/public)
src/config/api-endpoints.ts             # add BRANCHES.PUBLIC_LIST

# Shared lift (DRY)
src/components/borrower/
  photo-crop-dialog.tsx                 # lifted from src/app/(app)/borrowers/[id]/_components/
  id-crop-dialog.tsx                    # lifted from src/app/(app)/borrowers/new/_components/
```

## Admin review page impact

`src/app/(app)/borrowers/registrations/[id]/page.tsx` currently displays the small registration field set. After this change, pending rows will carry photo, valid IDs, spouse info, and employment data. The review page must render those sections so reviewers can verify them. This is in scope for the implementation plan that follows.

## Risks

- **Anonymous media upload abuse** — mitigated by `submission_token` binding + rate limiting. Without the token, anyone could overwrite arbitrary photos by guessing IDs.
- **Branch enumeration via `GET /branches/public`** — acceptable (branch names are not sensitive); slim payload reduces incidental disclosure.
- **Frontend ships before backend** — `POST /borrowers/{id}/photo` and `valid-ids` will fail with 401 for public users until backend lands. UI should already handle partial-upload failure gracefully.
