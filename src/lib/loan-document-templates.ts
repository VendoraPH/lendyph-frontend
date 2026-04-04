import type { LoanDisclosure, LoanPromissoryNote } from "@/types";

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount || 0);

const clean = (str?: string) => (str ?? "").replace(/_/g, " ");

const fmtDate = (date?: string) => {
  if (!date) return "_______________";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
    padding: 0.75in 1in;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  .no-print {
    position: fixed; top: 16px; right: 16px; z-index: 100;
    display: flex; gap: 8px;
  }
  .no-print button {
    padding: 8px 20px; border: 1px solid #ccc; border-radius: 6px;
    cursor: pointer; font-size: 11pt; font-family: sans-serif; background: #fff;
  }
  .no-print button:first-child { background: #f97316; color: #fff; border-color: #f97316; }
  .no-print button:first-child:hover { background: #ea580c; }
  .header { text-align: center; margin-bottom: 24pt; }
  .header h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4pt; }
  .header h2 { font-size: 11pt; font-weight: normal; color: #555; }
  .header .line { border-bottom: 2px solid #000; margin: 8pt auto; width: 60%; }
  .section { margin-bottom: 16pt; }
  .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3pt; margin-bottom: 8pt; letter-spacing: 1px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt 24pt; }
  .info-row { display: flex; justify-content: space-between; padding: 2pt 0; }
  .info-label { color: #333; }
  .info-value { font-weight: bold; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8pt; }
  th { background: #f5f5f5; border: 1px solid #999; padding: 6pt 8pt; text-align: center; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
  td { border: 1px solid #ccc; padding: 5pt 8pt; }
  td.num { text-align: right; font-family: "Courier New", monospace; }
  td.center { text-align: center; }
  tfoot td { border-top: 2px solid #000; font-weight: bold; background: #f9f9f9; }
  .summary-box { border: 1px solid #000; padding: 12pt 16pt; margin-top: 12pt; background: #fafafa; }
  .summary-row { display: flex; justify-content: space-between; padding: 3pt 0; }
  .summary-row.total { border-top: 2px solid #000; margin-top: 6pt; padding-top: 6pt; font-size: 13pt; }
  .signature-section { margin-top: 48pt; page-break-inside: avoid; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48pt; margin-top: 24pt; }
  .sig-block { text-align: center; }
  .sig-line { border-bottom: 1px solid #000; height: 36pt; margin-bottom: 4pt; }
  .sig-name { font-weight: bold; font-size: 11pt; }
  .sig-label { font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .legal-text { font-size: 9.5pt; line-height: 1.5; color: #333; text-align: justify; margin-top: 12pt; }
  .legal-text p { margin-bottom: 8pt; text-indent: 24pt; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72pt; color: rgba(0,0,0,0.03); font-weight: bold; letter-spacing: 12px; pointer-events: none; z-index: -1; }
  .page-break { page-break-before: always; }
  .footer { margin-top: 32pt; text-align: center; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 8pt; }
`;

const TOOLBAR = `
  <div class="no-print">
    <button onclick="window.print()">Print Document</button>
    <button onclick="window.close()">Close</button>
  </div>
`;

export function generateDisclosureHTML(data: LoanDisclosure): string {
  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalInterest = (data.total_payable || 0) - (data.principal_amount || 0);
  const totalDeductions = (data.processing_fee || 0) + (data.service_fee || 0) + (data.other_deductions || 0);

  const scheduleRows = (data.amortization_schedule ?? [])
    .map(
      (row) => `
      <tr>
        <td class="center">${row.period}</td>
        <td class="center">${fmtDate(row.due_date)}</td>
        <td class="num">${fmt(row.principal)}</td>
        <td class="num">${fmt(row.interest)}</td>
        <td class="num">${fmt(row.amount_due)}</td>
        <td class="num">${fmt(row.balance)}</td>
      </tr>`
    )
    .join("");

  const totals = (data.amortization_schedule ?? []).reduce(
    (acc, r) => ({
      principal: acc.principal + r.principal,
      interest: acc.interest + r.interest,
      amount_due: acc.amount_due + r.amount_due,
    }),
    { principal: 0, interest: 0, amount_due: 0 }
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Disclosure Statement — ${data.application_number ?? `Loan #${data.loan_id}`}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${TOOLBAR}
  <div class="watermark">DISCLOSURE</div>

  <div class="header">
    <h1>Disclosure Statement</h1>
    <div class="line"></div>
    <h2>Truth in Lending Act (R.A. 3765)</h2>
  </div>

  <div class="section">
    <div class="section-title">Loan Information</div>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-label">Application No.:</span>
        <span class="info-value">${data.application_number ?? `LN-${data.loan_id}`}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date:</span>
        <span class="info-value">${today}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Borrower:</span>
        <span class="info-value">${data.borrower_name || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Interest Type:</span>
        <span class="info-value">${clean(data.interest_type) || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Principal Amount:</span>
        <span class="info-value">${fmt(data.principal_amount)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Interest Rate:</span>
        <span class="info-value">${data.interest_rate || 0}% per month</span>
      </div>
      <div class="info-row">
        <span class="info-label">Term:</span>
        <span class="info-value">${data.term_months || 0} month(s)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment Frequency:</span>
        <span class="info-value">${clean(data.payment_frequency)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Charges &amp; Deductions</div>
    <div class="summary-box">
      <div class="summary-row">
        <span>Processing Fee</span>
        <span>${fmt(data.processing_fee)}</span>
      </div>
      <div class="summary-row">
        <span>Service Fee</span>
        <span>${fmt(data.service_fee)}</span>
      </div>
      <div class="summary-row">
        <span>Other Deductions</span>
        <span>${fmt(data.other_deductions)}</span>
      </div>
      <div class="summary-row total">
        <span>Total Deductions</span>
        <span>${fmt(totalDeductions)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Financial Summary</div>
    <div class="summary-box">
      <div class="summary-row">
        <span>Principal Amount</span>
        <span>${fmt(data.principal_amount)}</span>
      </div>
      <div class="summary-row">
        <span>Less: Total Deductions</span>
        <span>(${fmt(totalDeductions)})</span>
      </div>
      <div class="summary-row total">
        <span><strong>Net Proceeds (Amount Received)</strong></span>
        <span><strong>${fmt(data.net_proceeds)}</strong></span>
      </div>
    </div>
    <div class="summary-box" style="margin-top: 8pt;">
      <div class="summary-row">
        <span>Total Interest Charges</span>
        <span>${fmt(totalInterest)}</span>
      </div>
      <div class="summary-row total">
        <span><strong>Total Amount Payable</strong></span>
        <span><strong>${fmt(data.total_payable)}</strong></span>
      </div>
    </div>
  </div>

  ${
    data.amortization_schedule?.length
      ? `
  <div class="section${(data.amortization_schedule?.length ?? 0) > 12 ? " page-break" : ""}">
    <div class="section-title">Amortization Schedule</div>
    <table>
      <thead>
        <tr>
          <th style="width:6%">#</th>
          <th style="width:20%">Due Date</th>
          <th style="width:18%">Principal</th>
          <th style="width:18%">Interest</th>
          <th style="width:20%">Amount Due</th>
          <th style="width:18%">Balance</th>
        </tr>
      </thead>
      <tbody>${scheduleRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align:center; font-weight:bold;">TOTAL</td>
          <td class="num">${fmt(totals.principal)}</td>
          <td class="num">${fmt(totals.interest)}</td>
          <td class="num">${fmt(totals.amount_due)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>`
      : ""
  }

  <div class="section legal-text">
    <p>I/We acknowledge receipt of a copy of this Disclosure Statement prior to the consummation of the loan transaction. I/We have read and understood all the terms and conditions stated herein and agree to be bound by them.</p>
    <p>This disclosure is made in compliance with Republic Act No. 3765, otherwise known as the "Truth in Lending Act," and its implementing rules and regulations.</p>
  </div>

  <div class="signature-section">
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${data.borrower_name || "—"}</div>
        <div class="sig-label">Borrower's Signature Over Printed Name</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Authorized Representative</div>
        <div class="sig-label">Lender's Signature Over Printed Name</div>
      </div>
    </div>
    <div style="text-align:center; margin-top:32pt;">
      <div class="info-row" style="justify-content:center; gap:8pt;">
        <span class="info-label">Date Signed:</span>
        <span style="border-bottom:1px solid #000; min-width:200px; display:inline-block;">&nbsp;</span>
      </div>
    </div>
  </div>

  <div class="footer">
    This is a system-generated document. • ${data.application_number ?? `Loan #${data.loan_id}`}
  </div>
</body>
</html>`;
}

export function generatePromissoryNoteHTML(data: LoanPromissoryNote): string {
  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promissory Note — ${data.application_number ?? `Loan #${data.loan_id}`}</title>
  <style>${BASE_STYLES}
    .amount-words { font-size: 11pt; font-style: italic; color: #333; }
    .pn-body { font-size: 11.5pt; line-height: 1.8; text-align: justify; }
    .pn-body p { margin-bottom: 12pt; text-indent: 36pt; }
    .pn-body .highlight { font-weight: bold; text-decoration: underline; }
    .terms-table { margin: 12pt 0; }
    .terms-table td { padding: 4pt 12pt; border: none; font-size: 11pt; }
    .terms-table td:first-child { font-weight: bold; width: 200px; color: #333; }
  </style>
</head>
<body>
  ${TOOLBAR}
  <div class="watermark">PROMISSORY NOTE</div>

  <div class="header">
    <h1>Promissory Note</h1>
    <div class="line"></div>
  </div>

  <div style="display:flex; justify-content:space-between; margin-bottom:20pt;">
    <div>
      <div class="info-row">
        <span class="info-label">Reference No.:</span>&nbsp;
        <span class="info-value">${data.application_number ?? `LN-${data.loan_id}`}</span>
      </div>
    </div>
    <div>
      <div class="info-row">
        <span class="info-label">Date:</span>&nbsp;
        <span class="info-value">${fmtDate(data.release_date) !== "_______________" ? fmtDate(data.release_date) : today}</span>
      </div>
    </div>
  </div>

  <div class="pn-body">
    <p>
      FOR VALUE RECEIVED, I/We, <span class="highlight">${data.borrower_name || "—"}</span>${data.borrower_address ? `, of legal age, residing at <span class="highlight">${data.borrower_address}</span>` : ""},
      (hereinafter referred to as the "Borrower"), promise to pay to the order of the LENDER,
      the principal sum of <span class="highlight">${fmt(data.principal_amount)}</span>
      (Philippine Currency), with interest at the rate of <span class="highlight">${data.interest_rate || 0}%</span> per month,
      computed on a <span class="highlight">${clean(data.interest_type) || "—"}</span> basis.
    </p>

    <p>
      The total amount payable, inclusive of principal and interest, shall be
      <span class="highlight">${fmt(data.total_payable)}</span>,
      to be paid in <span class="highlight">${data.term_months || 0}</span> ${clean(data.payment_frequency)} installment(s),
      commencing on <span class="highlight">${fmtDate(data.release_date)}</span>
      and ending on <span class="highlight">${fmtDate(data.maturity_date)}</span>.
    </p>
  </div>

  <div class="section" style="margin-top:16pt;">
    <div class="section-title">Loan Terms</div>
    <table class="terms-table">
      <tr>
        <td>Principal Amount</td>
        <td>${fmt(data.principal_amount)}</td>
      </tr>
      <tr>
        <td>Interest Rate</td>
        <td>${data.interest_rate || 0}% per month (${clean(data.interest_type) || "—"})</td>
      </tr>
      <tr>
        <td>Term</td>
        <td>${data.term_months || 0} month(s)</td>
      </tr>
      <tr>
        <td>Payment Frequency</td>
        <td>${clean(data.payment_frequency).charAt(0).toUpperCase() + clean(data.payment_frequency).slice(1)}</td>
      </tr>
      <tr>
        <td>Release Date</td>
        <td>${fmtDate(data.release_date)}</td>
      </tr>
      <tr>
        <td>Maturity Date</td>
        <td>${fmtDate(data.maturity_date)}</td>
      </tr>
      <tr style="border-top:1px solid #000;">
        <td style="font-size:12pt;"><strong>Total Amount Payable</strong></td>
        <td style="font-size:12pt;"><strong>${fmt(data.total_payable)}</strong></td>
      </tr>
    </table>
  </div>

  <div class="pn-body" style="margin-top:16pt;">
    <p>
      In case of default in the payment of any installment due, the entire outstanding balance shall immediately become due and demandable, without need of further notice or demand, and shall be subject to a penalty charge as may be imposed by the Lender.
    </p>

    <p>
      I/We further agree that in case of judicial or extrajudicial proceedings to enforce collection, I/We shall pay an additional amount equivalent to the cost of collection, including but not limited to attorney's fees and litigation expenses.
    </p>

    <p>
      I/We hereby waive presentment for payment, notice of dishonor, protest, and notice of protest, and agree to any extension or renewal hereof without notice.
    </p>
  </div>

  ${
    data.co_maker_name
      ? `
  <div class="section" style="margin-top:16pt;">
    <div class="section-title">Co-Maker / Surety</div>
    <div class="pn-body">
      <p>
        I, <span class="highlight">${data.co_maker_name}</span>${data.co_maker_address ? `, residing at <span class="highlight">${data.co_maker_address}</span>` : ""},
        hereby bind myself jointly and severally with the above-named Borrower for the faithful payment
        of the obligation stated herein under the same terms and conditions.
      </p>
    </div>
  </div>`
      : ""
  }

  <div class="signature-section">
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${data.borrower_name || "—"}</div>
        <div class="sig-label">Borrower</div>
      </div>
      ${
        data.co_maker_name
          ? `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${data.co_maker_name}</div>
        <div class="sig-label">Co-Maker / Surety</div>
      </div>`
          : `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Authorized Representative</div>
        <div class="sig-label">Lender</div>
      </div>`
      }
    </div>

    <div style="margin-top:36pt;">
      <div class="section-title">Signed in the Presence of:</div>
      <div class="sig-grid" style="margin-top:24pt;">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Witness 1</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Witness 2</div>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    This is a system-generated document. • ${data.application_number ?? `Loan #${data.loan_id}`}
  </div>
</body>
</html>`;
}
