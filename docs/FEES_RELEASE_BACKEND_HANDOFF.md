# Product fees at loan release

## Confirmed backend gap

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

Automatic application of Settings fees remains pending backend implementation. This branch does not send unsupported release fields or present locally calculated fees as persisted charges.
