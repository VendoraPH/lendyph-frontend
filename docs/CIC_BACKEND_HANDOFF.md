# CIC Reporting: Backend Handoff

The frontend is built behind `NEXT_PUBLIC_ENABLE_CIC`. `lendyph-backend` has no CIC routes yet, so every screen shows "Not connected yet". Types: `src/types/cic.ts`. Field-by-field source mapping: `docs/superpowers/specs/2026-11-27-cic-reporting-design.md`.

**The server is the single source of truth.** It maps members and loans to CIC records, validates them, builds and formats the file, masks what staff see, zips and encrypts it. The browser receives counts, issues and masked labels only, never a record's personal data, the plain TXT or the ZIP. The frontend bundles CIC's code lists (`src/lib/cic/domains.generated.ts`) only for the product-mapping dropdowns.

## Permissions

Seed `cic:view`, `cic:prepare`, `cic:submit`, `cic:review` and `cic:settings`, for admin and super_admin.

Every CIC route also requires `branches:view_all`: the file covers the whole cooperative. The menu and every page check both (`CicGuard`).

Add the module key `cic` to the Menu Visibility contract, between `credit_scoring` and `cda`. The frontend registers it in `src/constants/menu-modules.ts`.

## Endpoints

All responses use the usual `{success, data}` envelope. Lists are paginated with `meta` (per_page up to 100). Answer 501 from any route until it is built.

### Settings and key

| Endpoint | Permission | Logic |
|---|---|---|
| `GET /cic/settings` | view | `provider_code`, `is_mfi`, `contact_name`, `contact_email`, and `public_key` (`CicPublicKey`, or null). `public_key.status` is `valid`, `unverified` or `expired`. |
| `PUT /cic/settings` | settings | Saves the first four fields. Rejects a `provider_code` that is not exactly 8 letters or digits. |
| `POST /cic/settings/public-key` | settings | Multipart `public_key`, plus `reason` (required when a key already exists). Parse the armored public key and reject private keys and anything unreadable. The new key starts `unverified`. A replaced key moves to the history with the reason. |
| `POST /cic/settings/public-key/verify` | settings | Body `{fingerprint}`, typed by the admin from CIC's out-of-band copy. 422 unless it equals the stored key's fingerprint (ignore spaces and case). Sets `verified_at` and `verified_by`. |
| `DELETE /cic/settings/public-key` | settings | Body `{reason}` (required). Moves the key to the history. |
| `GET /cic/settings/public-key/history` | settings | Retired keys: `fingerprint`, `uploaded_at/by`, `retired_at/by`, `retired_reason`. |
| `GET /cic/product-mappings` | settings | One row per loan product, mapped or not: `loan_product_id`, `loan_product_name`, `record_type` (CI, CN or null), `contract_type`, `purpose`. |
| `PUT /cic/product-mappings` | settings | Body `{mappings: [...]}`. Upserts and returns the full list. `contract_type` must belong to the record's `ContractTypeDomain`. CC is not offered: the cooperative grants no credit card. |

### Readiness, records and issues (all as of `reference_date`)

| Endpoint | Permission | Logic |
|---|---|---|
| `GET /cic/readiness?reference_date=` | view | `subjects` and `contracts` (`total`, `ready`, `with_errors`), `issue_counts` (`errors`, `warnings`, `infos`), `unmapped_products`, `top_issues` and `last_submission`. |
| `GET /cic/subjects` | view | Params `reference_date`, `search?`, `with_errors?`, `page`, `per_page`. Rows are `CicRecordSummary`: `id`, `number` (the Provider Subject No.), `label` (the name **masked**, e.g. `J*** D***`), `record_type`, `error_count` and `warning_count`. No field values. |
| `GET /cic/contracts` | view | The same as subjects, for every reportable loan: `number` is the loan number, and `contract_phase` is filled. |
| `GET /cic/issues` | view | Params `reference_date`, `severity` (`problems` = errors and warnings, `error`, `warning`, `info` or `all`), `page` and `per_page`. Rows are `CicIssue`: `severity`, `code`, `code_label` (the code in words), `message`, `record_type`, `record_label` (masked) and `field_id`/`field_name`. |
| `GET /cic/issues/export` | view | The same filters. Streams a CSV built on the server, with masked labels and `code_label` (not the raw key, e.g. `MISSING_MANDATORY`). Writes an audit row. |

### Submissions

| Endpoint | Permission | Logic |
|---|---|---|
| `GET /cic/submissions` | view | The submission history (`CicSubmission`). |
| `GET /cic/submissions/{id}` | view | One `CicSubmission`. |
| `GET /cic/submissions/{id}/issues` (and `/issues/export`) | view | The snapshot's issues, paged and filtered like `/cic/issues`. The export is audited. |
| `POST /cic/submissions` | prepare | Body `file_reference_date`, `submission_type` (0 or 1), `comments?`, `corrects_submission_id?` and `correction_reason?`. Both are required when the type is 1. Builds the pipe-delimited file (HD, subjects ID/BD, SL, contracts CI/CN, NE, then FT) and validates it. Refuses with 422 on any error. Stores the plain file and its SHA-256 `checksum` with status `generated`. The filename is `{provider}_CSDF_{YYYYMMDDhhmmss}.txt` in Manila time. |
| `GET /cic/submissions/{id}/preview` | prepare or submit | `CicFilePreview`: the header, the first records and the footer with personal data **masked**, plus `line_count`, `byte_size` and `record_counts` per type. It is used for the pre-encryption review. |
| `POST /cic/submissions/{id}/encrypt` | submit | Body `{confirmed: true, key_fingerprint}`. Refuse with 422 unless `confirmed` is true, the stored key is `valid` (verified and unexpired), and `key_fingerprint` equals it. Zip the TXT, encrypt the ZIP to `{filename without .txt}.zip.gpg` (CIC's `gpg --encrypt …zip`), and record `encrypted_filename`, `encrypted_checksum` (SHA-256), `key_fingerprint`, `encrypted_at` and `encrypted_by`. Status becomes `encrypted`. |
| `GET /cic/submissions/{id}/download` | submit | Streams the `.zip.gpg` only. The plain TXT and the ZIP are never served. Audited. |
| `POST /cic/submissions/{id}/mark-submitted` | submit | Allowed only from `encrypted`. Sets `submitted_at`; status `submitted`. |
| `POST /cic/submissions/{id}/acknowledgement` | review | Body `status` (accepted or rejected) and `notes?`. Allowed only from `submitted`. Sets `acknowledged_at`. |

## Rules the frontend relies on

- **Audit events (§16).** Write an audit row for every settings save, key upload, verification, replacement and removal (with the reason), and for every mapping save. Also audit each generate, preview, encrypt, download, mark-submitted and acknowledgement, and every CSV export.
- **Immutable snapshot (§15).** A generated submission freezes its records, issues, counts, checksum and settings. Later edits to members or loans never change it. Its issues and preview are read from the snapshot.
- **Correction (§14.2).** Type 1 needs `corrects_submission_id` and a `correction_reason` (max 500), shown on the submission page.
- **Per-loan override (§3.3).** A loan may override its product's mapping (record type, contract type, purpose) with a required reason, which is audited. Expose it on a later route. The frontend will add the screen once the route exists.
- **SL and NE records.** Build subject links (co-makers) and negative events. `record_counts` and the issues use the record types `SL` and `NE`.
- **Retention.** Keep the plain TXT on the server only as long as the retention policy allows (to be agreed), then delete it, keeping the checksum. It is never downloadable.
- **Key refusal.** An `expired` or `unverified` key never encrypts, whatever the client sends.

## Format rules

- Text is UTF-8 without a BOM, one record per line, fields joined by `|`.
- Every field of the layout is present. An empty field is nothing between two pipes, and there is no trailing pipe.
- Dates are `DDMMYYYY`. Amounts are whole pesos with no separators, rounded half away from zero, done on the server.
- Line endings are CRLF until CIC says otherwise.
- The FT record count excludes HD and FT.
- Layout fixes from the review: `SL1` is 2 characters (fixed `SL`), `BD20` and `BD31` take `AddressTypeDomain`, and `CN22` takes `CreditPurposeDomain`.
