# Product fees at loan release

**Shipped 2026-09-19** across `lendyph-backend#116` and `lendyph-frontend#323`. The backend work
below is done; `app/Services/LoanReleaseFeeService.php` implements all six items and is wired into
`LoanService::release()`, covered by `tests/Feature/LoanReleaseFeesTest.php`.

Kept rather than deleted, per the convention the sibling handoffs follow: a contract that exists
nowhere is how the Credit Scoring one was lost and had to be reconstructed from shipped TypeScript.
See **As built** at the end for the two places the implementation says more than this document asked
for.

## Confirmed backend gap (as of September 14, 2026 — since closed)

Checked `VendoraPH/lendyph-backend`, branch `development`, on September 14, 2026.

- `FeeController` saves `name`, `type`, `value`, `applicable_product_ids`, and `conditions`.
- `LoanService::release()` applies insurance but never loads the saved `Fee` rules.
- `ReleaseLoanRequest` accepts only insurance fields. Sending additional deductions from the frontend will not implement this behavior.
- `LoanService::createLoan()` initializes processing, service, and notarial deductions. Existing charges must be preserved when adding release fees.

## Backend work needed

1. Within the existing release transaction, select the fees applicable to the loan's `loan_product_id`. Empty/null `applicable_product_ids` means all products, matching the existing Settings UI.
2. Evaluate all populated `conditions`: `term_days_gt/lt/eq` and `loan_amount_gt/lt/eq`. Define term days consistently using the loan's agreed dates; `gt` and `lt` are strict comparisons.
3. Calculate fixed fees as peso amounts and percentage fees from principal, rounded to two decimals. Prevent the same fee from being charged twice, including charges already recorded on the loan.
4. Persist the itemized `deductions`, `total_deductions`, and `net_proceeds`, together with the release and insurance changes. Reject totals exceeding principal; repeated release attempts must not add charges again. Existing released loans must remain unchanged.
5. Provide a read-only release preview, authorized for the releasing role. Suggested response: `{ data: { deductions, total_deductions, net_proceeds } }`, where deductions use the existing `{ name, amount, type, original_value }` shape. Use the same calculation for preview and release. Coordinate the endpoint before frontend integration; it is not called by this frontend change.
6. Protect confirmation from a changed fee configuration after preview, so the cashier does not confirm one amount and disburse another.

## Acceptance example

For a ₱10,000 loan under Product A, with a ₱500 fixed fee and a 2% fee applicable to A, deductions are ₱700 and net proceeds are ₱9,300, before other existing deductions or insurance. A fee assigned only to Product B must not apply. Test non-matching conditions, existing deductions, partial insurance, excessive deductions, and a repeated release request.

## Frontend changes in this branch

- Align fee viewing and CRUD controls with `fees:view/create/update/delete` and expose Fees in the role editor.
- Validate fee values and conditions; send `conditions: null` when clearing rules.
- Show API validation errors and distinguish failed loading from an empty fee list.
- Preserve product-specific labels if product names cannot be loaded.
- Show the loan's existing API-provided itemized deductions in the release dialog.

## As built

Two contract facts the implementation settled that this document never asked about. Both were
recorded only in a PHP docblock, which is the wrong place for something the frontend has to know.

**1. Release fees are APPENDED to the product's own deductions, not merged with them.**
`LoanService::createLoan()` already derives deductions from the loan product's `processing_fee` /
`service_fee` / `notarial_fee` columns at *application* time. That is a separate mechanism with a
different owner and a different moment, and this handoff did not mention it.

The consequence is visible to users: **a `fees` row named "Processing Fee" and a product carrying
`processing_fee` will BOTH charge**, because they are two independently configured charges that
happen to share a label. Suppressing one by matching names would silently drop a charge the borrower
signed a disclosure for, so it is deliberately not done. If a co-op sees a doubled fee, the fix is
configuration — remove one of the two — not code.

**2. `fee_fingerprint` is OPTIONAL on release, and the 409 only fires when one is sent.**
`ReleaseLoanRequest` types it `['nullable','string','max:255']`, and the guard returns early on a
null or empty value. So a client that never sends a fingerprint is never protected against a fee
configuration that changed between preview and confirm — it is opt-in, not automatic. Send back the
fingerprint the preview returned to get the protection.

The preview endpoint shipped as `GET /api/loans/{loan}/release-preview`.

---

*Original closing note, now superseded: "Automatic application of Settings fees remains pending
backend implementation." That was true when written and is no longer.*
