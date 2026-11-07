# CDA Compliance: backend handoff

The frontend is built (`src/app/(app)/cda/`) behind `NEXT_PUBLIC_ENABLE_CDA`.
Every screen shows "Not connected yet" until its route answers (404/501 = not built).
The exact request and response shapes are the types in `src/types/cda.ts`, and the paths are `API_ENDPOINTS.CDA`.
None of this exists in `lendyph-backend` yet.

Swagger was unreachable when this was written, so the contract has not been checked against the backend.

## Permissions

Seed these permissions for admin and super_admin:

- `cda:view`
- `cda:prepare`
- `cda:upload`
- `cda:review`
- `cda:finalize`
- `cda:reopen`
- `cda:submit`
- `cda:manage_officers`
- `cda:manage_social`
- `cda:manage_mediation`
- `cda:settings`

Enforce each one on its route. The frontend only hides the controls.

## Periods (`year` = the fiscal year reported on)

| Endpoint | Logic |
|---|---|
| `GET /cda/periods` | All years |
| `POST /cda/periods {year}` | Opens a year. `default_deadline` = fiscal year-end + `settings.deadline_days` (120). Creates every report from the active template that fits the regulatory profile |
| `PATCH /cda/periods/{year} {extended_deadline}` | Records a CDA extension. `null` clears it |
| `GET /cda/periods/{year}/dashboard` | Returns period, readiness 0–100 (mean of applicable reports), per-report summaries and all open issues. ATIR/ABR is `applicable:false` unless `cte_status` is `yes` |
| `GET /cda/periods/{year}/calendar` | One row per report: deadline, extension, status |

## Reports (`type` = `capr`, `financial_statements`, `performance_audit`, `social_audit`, `pesos`, `officers`, `mediation`, `sworn_statement`, `atir_abr`)

| Endpoint | Logic |
|---|---|
| `GET /cda/periods/{year}/reports/{type}` | Sections, fields and tables built from the template. Auto fields are computed from the GL, loans, members and share capital, and each one carries its `source`. Also returns validation issues (critical/warning/info), readiness, history and `available` flags |
| `PUT …/reports/{type} {values:{key:{value,remarks}}}` | Saves the editable fields only. Re-runs validation. Answers 409/422 when the report is locked |
| `POST …/reports/{type}/workflow {action, reason?}` | Status machine, described below. `reason` is required for return, reopen and mark_correction_required |

The status machine:

- not_started, draft or returned → validate / submit_for_review
- for_review → return / approve (`cda:review`)
- approved → finalize (`cda:finalize`)
- finalized → mark_submitted (`cda:submit`) / reopen (`cda:reopen`)
- submitted → mark_accepted / mark_correction_required / reopen

submit_for_review and finalize are refused while any critical issue is open.

On finalize, store a snapshot of every value and a SHA-256 `checksum`. A finalized report is read-only until it is reopened.

Write an audit event (who, when, action, reason) for every transition and every save. Return those events as `history`.

## Read-only computations

- `GET /cda/periods/{year}/loan-classification`: buckets loans by days past due at year-end. For each bucket, `required_allowance` = balance × rate. `provision_gap` = required − the allowance booked in the GL.
- `GET /cda/periods/{year}/pesos`: Enhanced PESOS. Returns component scores (with weights), each metric with its formula, source and score, the total, the rating and a trend over prior years.

## Registers

The `GET` routes return paginated lists in the standard `meta` envelope.

- Officers: `/cda/officers`, `/cda/officers/{id}` (CRUD, `cda:manage_officers`).
- Trainings: `/cda/trainings`, `/cda/trainings/{id}` (CRUD, multipart with an optional `certificate`). Recompute the officer's `hours_completed`.
- Social programs: `/cda/periods/{year}/social-programs` and `/cda/social-programs/{id}` (CRUD, `cda:manage_social`). These feed the social audit.
- Mediation cases: `/cda/periods/{year}/mediation-cases` and `/cda/mediation-cases/{id}` (CRUD, `cda:manage_mediation`). These feed the mediation report.
- Documents: `/cda/periods/{year}/documents` (list, plus a multipart upload with `file`). `/cda/documents/{id}/versions` lists versions, and POST adds one. Never overwrite a file. Uploads need `cda:upload`.
- Submissions: `/cda/periods/{year}/submissions` (list, plus a multipart create with optional `proof`) and `PUT /cda/submissions/{id}` (`cda:submit`).

## Settings (`cda:settings`)

- `GET/PUT /cda/regulatory-profile`: registration, CTE, auditor and officers.
- `GET/PUT /cda/settings`: `deadline_days`, `reminder_days` (e.g. 30, 15, 7, 3), `notify_roles`.
- `GET/POST /cda/templates` and `PUT /cda/templates/{id}`: versioned templates (`definition` JSON, effective dates, the cooperative types and asset classes they apply to, status draft/active/retired). A report keeps the template version it was created on.

## Notifications

A daily job notifies `notify_roles`:

- at each `reminder_days` milestone before the effective deadline (the extension if one is set);
- on the deadline day;
- once the deadline is overdue.

Skip reports that are already filed. Also notify on return, approval and correction_required.
