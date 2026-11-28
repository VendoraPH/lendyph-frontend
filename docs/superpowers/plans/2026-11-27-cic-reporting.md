# CIC Reporting: Implementation Plan

Design: `docs/superpowers/specs/2026-11-27-cic-reporting-design.md`. Backend: `docs/CIC_BACKEND_HANDOFF.md`.

## Frontend (this PR)

- [x] **Generate layouts and domains from CIC's 2016 workbooks.** The output is `src/lib/cic/*.generated.ts`, using structure only and no customer data.
- [x] **Write the field formatter and file builder.** `src/lib/cic/format.ts` and `csdf.ts` give:
  - dates as `DDMMYYYY`
  - whole-peso amounts
  - the header and footer records
  - the file name in Manila time
  - CRLF line endings
- [x] **Write the validation engine.** `src/lib/cic/validate.ts` checks:
  - mandatory and dependent fields
  - types, lengths and domains
  - the MFI rules
  - the provider code
- [x] **Map records to file inputs.** `src/lib/cic/records.ts` maps API records to inputs, counts issues per record and sets the default reference date.
- [x] **Add the API layer.** This is the types, endpoints, `cicService` and the `cic` permission module, all behind the `NEXT_PUBLIC_ENABLE_CIC` flag in the nav and settings.
- [x] **Build the screens.**
  - readiness
  - subjects and contracts
  - validation
  - the generate wizard
  - submissions and the submission detail page
  - corrections
  - settings
- [x] **Add tests.**
  - format, file builder and validation: `src/lib/cic/*.test.ts`
  - the wizard's step gating: `cic/generate/_lib/steps.test.ts`
- [x] **Write the docs.** This is the design spec, this plan and the backend handoff.

## Backend (handoff)

- [ ] Seed `cic:view|prepare|submit|review|settings`.
- [ ] Add the settings, public key and product mapping endpoints.
- [ ] Build the field mapping from Lendy data to the `values` of each record (see the design's mapping tables).
- [ ] Add the readiness, subjects and contracts endpoints, validated against the same rules.
- [ ] Add generation, PGP encryption, download, mark-submitted and acknowledgement.

## Before go-live

- [ ] Confirm the CSDF version with the bank and CIC: 2016 or COCREE 2.0. See "Open questions" in the design.
- [ ] Get the provider code and public key from CIC, then do a test submission on CIC's UAT portal.
- [ ] Add the `cic` module to the role editor once the backend seeds it. The exclusion is in `settings/user-roles/_lib/permission-matrix.ts`.
