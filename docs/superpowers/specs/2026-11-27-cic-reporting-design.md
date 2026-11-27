# CIC Reporting: Design

ClickUp: CIC Main Prompt (Phase 10, CIC Support). Flag: `NEXT_PUBLIC_ENABLE_CIC`. Backend contract: `docs/CIC_BACKEND_HANDOFF.md`.

## Goal

Lendy reports its members and loans to the Credit Information Corporation (CIC) as a Credit Submission Data File (CSDF):

1. **Prepare.** Map loan products to CIC contract types, and set the provider code and CIC's public key.
2. **Check.** Validate every member and loan against CIC's record layouts before a file exists.
3. **Generate.** Build the file, encrypt it with CIC's key, download it and upload it to CIC's portal.
4. **Track.** Record the submission and CIC's acceptance or rejection, and send correction files.

## Source documents

These are CIC's 2016 CSDF workbooks, in `docs/CIC/`, which is git-ignored because the samples hold real customer data:
- `data format.xlsx` holds the record layouts. It produced `src/lib/cic/layouts.generated.ts`.
- `Fields in Excel.xlsx` holds the domain code lists. It produced `domains.generated.ts`.

No customer data from those files is copied into the repo.

## Split of work

| | Frontend (`lendyph-web`) | Backend (`lendyph-backend`) |
|---|---|---|
| Layouts and codes | `src/lib/cic/` (generated, typed) | Its own copy, same rules |
| Mapping Lendy data to fields | No | Yes, serving `values` keyed by field id |
| Validation | Yes, live on every screen (`validateCsdf`) | Yes, again at generation, and authoritative |
| Building the file | Preview only (`buildCsdfFile`) | Builds the file that is stored and sent |
| Encryption (PGP) | No; the plain file never leaves the server | Yes, with CIC's public key |
| History and acknowledgement | Screens | Storage and state machine |

The backend owns the file because it holds the full record set, and because the plain file should never sit unencrypted on a teller's PC. The frontend runs the same validation, so users see and fix problems before they generate.

## Screens

| Route | Permission | Purpose |
|---|---|---|
| `/cic` | `cic:view` | Data Readiness: ready vs total records, top missing fields, unmapped products, last submission |
| `/cic/subjects` | `cic:view` | ID and BD records with per-record error and warning counts |
| `/cic/contracts` | `cic:view` | CI, CN and CC records with per-record counts |
| `/cic/validation` | `cic:view` | Every issue, filterable by severity, exportable as CSV |
| `/cic/generate` | `cic:prepare` | 8-step wizard: date and type, readiness, validation, preview, generate, encrypt, download, mark submitted. Encrypt, download and submit need `cic:submit` |
| `/cic/submissions`, `/cic/submissions/[id]` | `cic:view` | History; per-file actions; record CIC's answer (`cic:review`) |
| `/cic/corrections` | `cic:view` | Submitted files with "Prepare Correction" (submission type 1) |
| `/settings/cic` | `cic:settings` | Provider code, MFI switch, contact, public key, product mapping |

## Status flow

The happy path is `generated` → `encrypted` → `submitted`, and then CIC answers with `accepted` or `rejected`.

A correction file is a new submission with `submission_type` 1 and `corrects_submission_id` pointing at the file it corrects.

## CIC to Lendy mapping

Mandatory (M) fields, plus the dependent (D) fields Lendy can fill. Each row says where the backend takes the value from.

**Every record**
- `*2` Provider Code comes from CIC Settings.
- `*4` Reference Date is the File Reference Date.

**ID: individual (a member)**

| Field | Lendy source |
|---|---|
| ID5 Provider Subject No | Member number (stable; never reused) |
| ID3 Branch Code | Member's branch code |
| ID6–ID10 Title, First, Last, Middle Name, Suffix | Borrower name fields |
| ID13 Gender | Borrower gender, mapped to `GenderDomain` |
| ID14 Date of Birth | Borrower birth date |
| ID16–ID20 Country of birth, nationality, resident, civil status, dependants | Borrower profile, when captured |
| ID32–ID42 Address 1 | Present address (`MI`) |
| ID43–ID53 Address 2 | Permanent or mailing address (`AI`). CIC requires one for non-MFI lenders |
| ID54–ID59 Identification 1–3 | TIN, SSS and GSIS from KYC, mapped to `IdentificationTypeDomain` |
| ID60–ID77 ID 1–3 | KYC ID documents, mapped to `IDTypeDomain`, with issue and expiry dates |
| ID78–ID81 Contact 1–2 | Mobile, email, mapped to `ContactTypeDomain` |
| ID82 onward, Employment | Employer, occupation, income, when captured |

**BD: business (a juridical member)**
- BD5 is the member number.
- BD6 Trade Name is the business name.
- BD20–BD41 are the business addresses.
- BD42–BD45 hold the registration: TIN, then the DTI, SEC or CDA number.
- BD46–BD49 are the contacts.

**CI: installment contract (most loans)**

| Field | Lendy source |
|---|---|
| CI5 Provider Subject No | Borrower's member number |
| CI6 Role | `B` for the borrower; co-makers become linked subjects (CI126 onward) |
| CI7 Provider Contract No | Loan number |
| CI8 Contract Type | Product mapping (`CI:ContractTypeDomain`) |
| CI9 Contract Phase | Loan status: released or active → `AC`, closed or fully paid → `CL`, and so on |
| CI11, CI12 Currency | `PHP` |
| CI13 Contract Start Date | Release date |
| CI15 Contract End Planned Date | Maturity date |
| CI16 Contract End Actual Date | Date of full payment, when closed |
| CI20 Financed Amount | Principal |
| CI21 Installments Number | Number of amortizations |
| CI22 Transaction Type | Product mapping purpose, or the loan's purpose (`CreditPurposeDomain`) |
| CI24 Payment Periodicity | Payment frequency → `PaymentPeriodicityDomain` |
| CI26 Monthly Payment Amount | Amortization amount, as a monthly equivalent |
| CI27 First Payment Date, CI28 Last Payment Amount | First due date; last posted payment |
| CI31 Outstanding Payments Number | Unpaid installments left |
| CI32 Outstanding Balance | Principal balance as of the reference date |
| CI33–CI35 Overdue number, amount, days | From the schedule as of the reference date; days → `OverdueDaysDomain` |
| CI43 onward, Guarantors | Co-makers and collateral |

**CN: non-installment contract**
- Lines of credit and one-time-payment loans.
- CN20 Credit Limit is the approved amount.
- CN23 is the outstanding balance.
- The other fields follow CI.

**CC: credit card**
- Not offered by Lendy today.
- The mapping allows it so a product can be reported if one is added.

## Open questions for the bank and CIC

The workbook supplied is the 2016 CSDF (version 1.0). CIC's current COCREE 2.0 manual differs, and these must be confirmed before go-live:

1. **Provider code length:** 8 characters in 2016, 10 in COCREE.
2. **Date format:** `DDMMYYYY` in 2016, `YYYYMMDD` in COCREE.
3. **Record layouts:**
   - The HD header has 6 fields in 2016 and 9 in COCREE.
   - The ID record has 123 fields in 2016 and 86 in COCREE.
4. **Credit card records:** 2016 has a single CC record, while COCREE splits it into CA, CV and CF.
5. **File packaging:** a plain `.txt` encrypted with PGP in 2016, a `.zip.gpg` in COCREE.
6. **Missing code lists:**
   - Business address type codes for BD records are not in the domain list.
   - The workbook names `PurposeOfCreditDomain` but does not supply it; `CreditPurposeDomain` is used instead.
7. **Line endings:** not specified by the workbook. CRLF is assumed.

The generated layout and domain files, plus the provider-code check, are the only places to change once CIC confirms the version.
