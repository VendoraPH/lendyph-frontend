# CIC Reporting: Backend Handoff

The frontend is built behind `NEXT_PUBLIC_ENABLE_CIC`. `lendyph-backend` has no CIC routes yet, so every screen shows "Not connected yet". Types: `src/types/cic.ts`. Field layouts and code lists: `src/lib/cic/` (from CIC's 2016 CSDF workbook). Field-by-field source mapping: `docs/superpowers/specs/2026-11-27-cic-reporting-design.md`.

## Permissions

Seed `cic:view`, `cic:prepare`, `cic:submit`, `cic:review` and `cic:settings`, for admin and super_admin.

Add the module key `cic` to the Menu Visibility contract, between `credit_scoring` and `cda`. The frontend registers it in `src/constants/menu-modules.ts`.

## Endpoints

All responses use the usual `{success, data}` envelope. Lists are paginated with `meta`.

| Endpoint | Permission | Logic |
|---|---|---|
| `GET /cic/settings` | view | Returns `provider_code`, `is_mfi`, `contact_name`, `contact_email`, and `public_key` (`fingerprint`, `algorithm`, `user_id`, `uploaded_at`, `uploaded_by`, `expires_at`). `public_key` is null when no key is stored. |
| `PUT /cic/settings` | settings | Saves the first four fields. Rejects a `provider_code` that is not exactly 8 letters or digits. |
| `POST /cic/settings/public-key` | settings | Multipart field `public_key`. Parse the armored PGP public key, reject private keys and anything unreadable, then store it and return its metadata. |
| `DELETE /cic/settings/public-key` | settings | Removes the stored key. |
| `GET /cic/product-mappings` | settings | Returns one row per loan product, mapped or not: `loan_product_id`, `loan_product_name`, `record_type` (CI, CN, CC or null), `contract_type`, `purpose`. |
| `PUT /cic/product-mappings` | settings | Body `{mappings: [...]}`. Upserts the mappings and returns the full list. `contract_type` must belong to the record's `ContractTypeDomain`. |
| `GET /cic/readiness?reference_date=` | view | Validates every record as of the date and returns `subjects` and `contracts` (`total`, `ready`, `with_errors`), `unmapped_products`, `top_issues` (`field_id`, `field_name`, `count`) and `last_submission`. |
| `GET /cic/subjects?reference_date=` | view | One row per borrower with a reportable loan: `id`, `borrower_id`, `subject_no`, `name`, `record_type` (ID or BD), and `values` keyed by field id (`ID7`, …). |
| `GET /cic/contracts?reference_date=` | view | One row per reportable loan (mapped product, released, and open or closed within the period): `id`, `loan_id`, `loan_number`, `subject_no`, `borrower_name`, `record_type`, `contract_phase`, and `values` keyed by field id. |
| `GET /cic/submissions` | view | Lists the submission history. |
| `GET /cic/submissions/{id}` | view | Returns the submission plus `issues` (the frontend's `CicIssue` shape). |
| `POST /cic/submissions` | prepare | Body `file_reference_date`, `submission_type` (0 or 1), `comments?`, `corrects_submission_id?` (required when the type is 1). Builds the pipe-delimited file (HD, then subjects, then contracts, then FT), validates it, and refuses with 422 on any error. Stores the plain file and its SHA-256 checksum with status `generated`. The filename is `{provider}_CSDF_{YYYYMMDDhhmmss}.txt` in Manila time. |
| `POST /cic/submissions/{id}/encrypt` | submit | Encrypts the stored file with the stored public key, records `key_fingerprint`, and sets status `encrypted`. |
| `GET /cic/submissions/{id}/download` | submit | Streams the encrypted file. Never serves the plain file. |
| `POST /cic/submissions/{id}/mark-submitted` | submit | Allowed only from `encrypted`. Sets `submitted_at` and status `submitted`. |
| `POST /cic/submissions/{id}/acknowledgement` | review | Body `status` (accepted or rejected) and `notes?`. Allowed only from `submitted`. Sets `acknowledged_at`. |

Answer 501 from any of these until it is built, and the screen says "Not connected yet".

## Format rules the backend must match

The frontend's `src/lib/cic/csdf.ts` and its tests are the reference.

- Text is UTF-8 without a BOM, one record per line, fields joined by `|`.
- Every field of the layout is present. An empty field is nothing between two pipes, and there is no trailing pipe.
- Dates are `DDMMYYYY`.
- Amounts are whole pesos with no separators, rounded half away from zero.
- Line endings are CRLF until CIC says otherwise.
- The FT record count excludes HD and FT.
