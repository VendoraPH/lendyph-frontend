# CIC Reporting: Backend

The CIC backend is built in lendyph-backend PR #410 (`routes/api/cic/*.php`), and that API is the contract. The screens stay behind `NEXT_PUBLIC_ENABLE_CIC`; turn it on only where the backend has `CIC_ENABLED` on.

- **Permissions:** the backend seeds `cic:view|prepare|submit|review|settings` for admin and super_admin. Every route also needs `branches:view_all`, and member names and values need `borrowers:view`.
- **When it answers 404:** every `/cic` route answers 404 while `CIC_ENABLED` is off or Menu Visibility hides `cic`.
- **Where the work happens:** the server builds every record, validates it, and builds, zips and encrypts the file from a month-end, test or correction capture. The browser shows the server's results and never builds, validates or formats the file.

## Endpoints the frontend uses
Paths, from `src/config/api-endpoints.ts` (`API_ENDPOINTS.CIC`):

- **Status:** `GET /cic/status`
- **Settings:**
  - `GET /cic/settings`, `PUT /cic/settings`
  - `GET /cic/public-keys`, `POST /cic/public-keys` (`armored` or `file`)
  - `POST /cic/public-keys/{id}/verify` (`fingerprint`), `POST /cic/public-keys/{id}/retire` (`reason`)
  - `GET /cic/product-mappings`, `PUT /cic/product-mappings`, `DELETE /cic/product-mappings/{loan_product_id}`
  - `GET /cic/loan-overrides`, `POST /cic/loan-overrides`, `PUT /cic/loan-overrides/{id}`, `DELETE /cic/loan-overrides/{id}`: every write takes a `reason`
  - `GET /cic/code-mappings`, `PUT /cic/code-mappings`
- **Records:**
  - `GET /cic/readiness?reference_date=`
  - `GET /cic/records?record_type=&capture_id=|reference_date=&page=`
  - `GET /cic/records/{type}/{key}`
  - `GET /cic/issues`, `GET /cic/issues/export` (CSV, with the list's filters)
  - `GET /cic/captures`, `POST /cic/captures` (`kind: test|correction`, `corrects_capture_id`)
- **Submissions:**
  - `GET /cic/submissions` (rows carry `actions`), `POST /cic/submissions` (`capture_id`, `submission_type`, `confirm_warnings`, `corrects_submission_id`, `correction_reason`)
  - `GET /cic/submissions/{id}`: the pre-encryption review
  - `POST /cic/submissions/{id}/encrypt` (`confirm: true`)
  - `GET /cic/submissions/{id}/download`: the `.zip.gpg` only
  - `POST /cic/submissions/{id}/mark-submitted`
  - `POST /cic/submissions/{id}/acknowledgement` (`status`, `notes`, `cic_reference_no`)
