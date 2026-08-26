/**
 * Official Receipt — two copies, Borrower's and File.
 *
 * Source: `repaymentService.detail(id)` (`RepaymentResource`).
 *
 * A voided repayment is the one case a document must actively refuse to look
 * normal. The API keeps voided rows readable (they are part of the audit
 * trail), so nothing stops someone opening one and printing it — which is how a
 * cancelled payment ends up in a member's folder as proof. Every page of a
 * voided receipt is therefore stamped VOID in its copy label, its subtitle and
 * a banner above the figures, and the reason and date of the void are printed
 * alongside them.
 */

import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock, PrintChargeLine } from "../types";
import {
  BLANK_ORG,
  asRecord,
  currencyOrDash,
  dateField,
  dateOrBlank,
  dateTimeField,
  field,
  formatCurrency,
  generatedAt,
  humanize,
  moneyOrBlank,
  personName,
  pick,
  pickNumber,
  presentFields,
  type PrintableBuildOptions,
} from "./shared";

const COPIES = ["Borrower's Copy", "File Copy"];

export function buildOfficialReceiptDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const payment = asRecord(raw);

  /**
   * The payment could not be read at all.
   *
   * A receipt asserts. Failing soft to zero printed "TOTAL AMOUNT PAID P0.00"
   * and "Zero Pesos" over a Received-by rule — a receipt for a payment that was
   * never made, indistinguishable from a real one, while the caller toasted
   * "opened in a new tab". Every figure is blanked instead and the document
   * says on its face that it is not a receipt.
   */
  const incomplete = payment === null;
  const loan = asRecord(pick(payment, ["loan"]));
  const borrower =
    asRecord(pick(payment, ["borrower"])) ?? asRecord(pick(loan, ["borrower"]));

  // 'voided' is the frontend status; the backend column is 'voided' too, but a
  // void is also inferrable from `voided_at` on older rows.
  const voided =
    String(pick(payment, ["status"]) ?? "").toLowerCase() === "voided" ||
    pick(payment, ["voided_at"]) !== null;

  const receiptNumber = pick<string>(payment, ["receipt_number"]);
  // Null, not 0, when it is absent: nothing below may state a figure the API
  // did not send.
  const amountPaid = pickNumber(payment, ["amount_paid", "amount", "total"]);

  // `*_applied` is what RepaymentResource serialises; `*_paid` and the bare
  // names are its own aliases, kept here so an older response still itemises.
  const principal = pickNumber(payment, [
    "principal_applied",
    "principal_amount",
    "principal_paid",
    "principal",
  ]);
  const interest = pickNumber(payment, [
    "interest_applied",
    "interest_amount",
    "interest_paid",
    "interest",
  ]);
  const penalty = pickNumber(payment, [
    "penalty_applied",
    "penalty_amount",
    "penalty_paid",
    "penalty",
  ]);
  const overpayment = pickNumber(payment, ["overpayment", "excess_amount"]);
  const balanceAfter = pickNumber(payment, ["balance_after", "new_balance"]);
  const balanceBefore = pickNumber(payment, ["balance_before", "previous_balance"]);

  const borrowerName =
    pick(borrower, ["full_name", "name"]) ??
    pick(payment, ["borrower_name"]) ??
    pick(loan, ["borrower_name"]);
  const accountNumber =
    pick(payment, ["loan_account_number"]) ??
    pick(loan, ["loan_account_number", "application_number"]);

  const breakdown: PrintChargeLine[] = [
    { label: "Applied to Principal", amount: currencyOrDash(principal), indent: true },
    { label: "Applied to Interest", amount: currencyOrDash(interest), indent: true },
    { label: "Applied to Penalty", amount: currencyOrDash(penalty), indent: true },
  ];
  if ((overpayment ?? 0) > 0) {
    breakdown.push({
      label: "Advance / Overpayment",
      amount: formatCurrency(overpayment ?? 0),
      indent: true,
    });
  }
  breakdown.push({
    label: "TOTAL AMOUNT PAID",
    amount: moneyOrBlank(amountPaid),
    rule: "grand",
  });

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Official Receipt",
      subtitle: voided
        ? "VOID — CANCELLED, NOT VALID PROOF OF PAYMENT"
        : incomplete
          ? "BLANK FORM — PAYMENT RECORD UNAVAILABLE"
          : "Acknowledgment Receipt of Payment",
    },
  ];

  if (voided) {
    blocks.push(
      {
        kind: "paragraph",
        align: "center",
        html:
          "<strong>*** V O I D ***</strong><br>" +
          "This receipt has been cancelled and is <strong>not</strong> valid proof of payment. " +
          "The payment recorded below was reversed and does not reduce the loan balance.",
      },
      {
        kind: "fields",
        title: "Void Details",
        columns: 2,
        items: presentFields([
          dateTimeField("Voided on", pick(payment, ["voided_at"])),
          field(
            "Voided by",
            personName(payment, "voided_by_user", ["voided_by"])
          ),
          field("Reason", pick(payment, ["void_reason"])),
        ]),
      }
    );
  }

  blocks.push(
    {
      kind: "fields",
      title: "Payment Details",
      columns: 2,
      items: presentFields([
        field("Receipt No.", receiptNumber),
        dateField("Date", pick(payment, ["payment_date", "paid_at", "created_at"])),
        field("Received from", borrowerName),
        field("Loan Account No.", accountNumber),
        field(
          "Member No.",
          pick(borrower, ["borrower_code", "member_no", "code"])
        ),
        field(
          "Loan Product",
          pick(payment, ["loan_product_name"]) ?? pick(loan, ["loan_product_name"])
        ),
        field("Payment Method", humanize(pick(payment, ["method"]))),
        field("Reference No.", pick(payment, ["reference_number"])),
      ]),
    },
    {
      kind: "charges",
      title: "Application of Payment",
      lines: breakdown,
    },
    {
      kind: "fields",
      items: [
        amountPaid === null
          ? { label: "Amount in words", underline: true }
          : { label: "Amount in words", value: amountInWords(amountPaid) },
      ],
    },
    {
      kind: "fields",
      title: "Loan Balance",
      columns: 2,
      items: presentFields([
        field("Balance before payment", currencyOrDash(balanceBefore)),
        field("Balance after payment", currencyOrDash(balanceAfter)),
        dateField("Next due date", pick(payment, ["next_due_date"])),
        field("Remarks", pick(payment, ["remarks"])),
      ]),
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        {
          name: borrowerName ? String(borrowerName) : null,
          label: "Paid by",
          detail: "Member — Signature Over Printed Name",
        },
        {
          name:
            personName(payment, "received_by_user", ["collected_by", "received_by"]),
          label: "Received by",
          detail: `Date: ${dateOrBlank(pick(payment, ["payment_date", "paid_at"]))}`,
        },
      ],
    },
    {
      kind: "note",
      text: voided
        ? "VOID — retained for audit purposes only. Do not issue to the member as a receipt."
        : incomplete
          ? "The payment record could not be retrieved when this form was printed, so no amount is stated on it. It is NOT proof of payment. Verify the payment against the ledger and complete the form by hand before it is signed."
          : "This receipt is valid only for the payment described above. Please keep it for your records.",
    }
  );

  return {
    id: "official_receipt",
    org: options.org ?? BLANK_ORG,
    title: voided ? "Official Receipt (VOID)" : "Official Receipt",
    // The receipt number IS the document reference. Letting chrome mint a
    // fresh one would hand the member a second, differently-numbered copy of
    // the same payment.
    reference: receiptNumber ?? undefined,
    generatedAt: generatedAt(options.now),
    copies: voided ? COPIES.map((label) => `VOID — ${label}`) : COPIES,
    blocks,
    incomplete: incomplete || undefined,
    footerNote: voided
      ? "VOIDED PAYMENT — NOT A VALID OFFICIAL RECEIPT"
      : incomplete
        ? "BLANK FORM — payment record unavailable. NOT A VALID OFFICIAL RECEIPT."
        : "This is a system-generated Official Receipt.",
  };
}
