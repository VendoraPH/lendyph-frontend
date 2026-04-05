/**
 * Loan Document Templates — Philippine Legal Standards
 *
 * Disclosure Statement: R.A. 3765 (Truth in Lending Act), BSP Circular No. 730
 * Promissory Note: Act No. 2031 (Negotiable Instruments Law)
 */

import type { LoanDisclosure, LoanPromissoryNote } from "@/types";

// ── Formatters ──

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount || 0);

const clean = (str?: string) => (str ?? "").replace(/_/g, " ");

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const fmtDate = (date?: string) => {
  if (!date) return "_______________";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/** Convert number to words (Philippine Peso) */
function amountInWords(amount: number): string {
  if (!amount || amount <= 0) return "Zero Pesos";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n]!;
    if (n < 100) return tens[Math.floor(n / 10)]! + (n % 10 ? " " + ones[n % 10]! : "");
    if (n < 1000) return ones[Math.floor(n / 100)]! + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    return convert(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + convert(n % 1000000) : "");
  }

  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  let result = convert(pesos) + " Pesos";
  if (centavos > 0) result += " and " + convert(centavos) + " Centavos";
  return result;
}

// ── Styles ──

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
    padding: 0.6in 0.8in;
  }
  @media print {
    body { padding: 0.4in 0.6in; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
  .no-print {
    position: fixed; top: 12px; right: 12px; z-index: 100;
    display: flex; gap: 8px;
  }
  .no-print button {
    padding: 8px 20px; border: 1px solid #ccc; border-radius: 6px;
    cursor: pointer; font-size: 10pt; font-family: sans-serif; background: #fff;
  }
  .no-print button:first-child { background: #f97316; color: #fff; border-color: #f97316; }

  .doc-header { text-align: center; margin-bottom: 20pt; }
  .doc-header h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2pt; }
  .doc-header .subtitle { font-size: 9pt; margin-bottom: 6pt; }
  .doc-header .legal-ref { font-size: 8.5pt; font-style: italic; color: #444; }

  .field-row { display: flex; gap: 12pt; margin-bottom: 3pt; font-size: 10.5pt; }
  .field-label { min-width: 160pt; color: #333; }
  .field-value { font-weight: bold; flex: 1; }
  .field-underline { border-bottom: 1px solid #000; flex: 1; min-width: 120pt; font-weight: bold; }

  .section { margin-bottom: 14pt; }
  .section-title {
    font-size: 10pt; font-weight: bold; text-transform: uppercase;
    background: #f0f0f0; border: 1px solid #ccc;
    padding: 4pt 8pt; margin-bottom: 8pt; letter-spacing: 0.5px;
  }

  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th {
    background: #e8e8e8; border: 1px solid #999;
    padding: 4pt 6pt; text-align: center;
    font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px;
  }
  td { border: 1px solid #bbb; padding: 3pt 6pt; }
  td.num { text-align: right; font-family: "Courier New", monospace; font-size: 9pt; }
  td.ctr { text-align: center; }
  tfoot td { border-top: 2px solid #000; font-weight: bold; background: #f5f5f5; }

  .charges-table { width: 100%; font-size: 10.5pt; border-collapse: collapse; }
  .charges-table td { padding: 3pt 0; border: none; }
  .charges-table .amt { text-align: right; width: 140pt; }
  .charges-table .total-row td { border-top: 1px solid #000; font-weight: bold; padding-top: 6pt; }
  .charges-table .grand-total td { border-top: 2px double #000; font-weight: bold; font-size: 11pt; padding-top: 8pt; }

  .sig-section { margin-top: 40pt; page-break-inside: avoid; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40pt; }
  .sig-block { text-align: center; }
  .sig-line { border-bottom: 1px solid #000; height: 32pt; margin-bottom: 2pt; }
  .sig-name { font-weight: bold; font-size: 10.5pt; }
  .sig-label { font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-detail { font-size: 8pt; color: #666; margin-top: 1pt; }

  .legal-text { font-size: 10pt; line-height: 1.6; text-align: justify; margin-top: 10pt; }
  .legal-text p { margin-bottom: 8pt; text-indent: 24pt; }
  .legal-text ol { margin-left: 24pt; margin-bottom: 8pt; }
  .legal-text ol li { margin-bottom: 4pt; }

  .clause-title { font-weight: bold; font-size: 10pt; margin-top: 10pt; margin-bottom: 4pt; }

  .footer {
    margin-top: 24pt; text-align: center;
    font-size: 7.5pt; color: #999;
    border-top: 1px solid #ddd; padding-top: 6pt;
  }
`;

const TOOLBAR = `
  <div class="no-print">
    <button onclick="window.print()">Print Document</button>
    <button onclick="window.close()">Close</button>
  </div>
`;

// ── Disclosure Statement (R.A. 3765, BSP Circular 730) ──

export function generateDisclosureHTML(data: LoanDisclosure): string {
  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });

  const principal = data.principal_amount || 0;
  const processingFee = data.processing_fee || 0;
  const serviceFee = data.service_fee || 0;
  const otherDeductions = data.other_deductions || 0;
  const totalFinanceCharges = processingFee + serviceFee + otherDeductions;
  const netProceeds = data.net_proceeds || (principal - totalFinanceCharges);
  const totalPayable = data.total_payable || 0;
  const totalInterest = totalPayable - principal;
  const rate = data.interest_rate || 0;
  const annualRate = rate * 12;

  const schedule = data.amortization_schedule ?? [];
  const scheduleRows = schedule
    .map((row) => `
      <tr>
        <td class="ctr">${row.period}</td>
        <td class="ctr">${fmtDate(row.due_date)}</td>
        <td class="num">${fmt(row.principal)}</td>
        <td class="num">${fmt(row.interest)}</td>
        <td class="num">${fmt(row.amount_due)}</td>
        <td class="num">${fmt(row.balance)}</td>
      </tr>`)
    .join("");

  const totals = schedule.reduce(
    (acc, r) => ({
      principal: acc.principal + (r.principal || 0),
      interest: acc.interest + (r.interest || 0),
      amount_due: acc.amount_due + (r.amount_due || 0),
    }),
    { principal: 0, interest: 0, amount_due: 0 }
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Disclosure Statement — ${data.application_number ?? data.loan_id}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${TOOLBAR}

  <div class="doc-header">
    <h1>Disclosure Statement</h1>
    <div class="subtitle">on Loan / Credit Transaction</div>
    <div class="legal-ref">Required under Republic Act No. 3765 (Truth in Lending Act) and BSP Circular No. 730, Series of 2011</div>
  </div>

  <!-- Borrower & Loan Information -->
  <div class="section">
    <div class="section-title">I. Borrower &amp; Loan Information</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2pt 20pt;">
      <div class="field-row"><span class="field-label">Name of Borrower:</span><span class="field-value">${data.borrower_name || "_______________"}</span></div>
      <div class="field-row"><span class="field-label">Loan Account No.:</span><span class="field-value">${data.application_number ?? data.loan_id}</span></div>
      <div class="field-row"><span class="field-label">Date Granted:</span><span class="field-value">${today}</span></div>
      <div class="field-row"><span class="field-label">Type of Loan:</span><span class="field-value">${capitalize(clean(data.interest_type)) || "—"}</span></div>
      <div class="field-row"><span class="field-label">Term of Loan:</span><span class="field-value">${data.term_months || 0} month(s)</span></div>
      <div class="field-row"><span class="field-label">Mode of Payment:</span><span class="field-value">${capitalize(clean(data.payment_frequency)) || "—"}</span></div>
    </div>
  </div>

  <!-- Amount Details (BSP Required) -->
  <div class="section">
    <div class="section-title">II. Amount of Credit / Loan</div>
    <table class="charges-table">
      <tr>
        <td><strong>1. Principal Loan Amount</strong></td>
        <td class="amt"><strong>${fmt(principal)}</strong></td>
      </tr>
    </table>
  </div>

  <!-- Finance Charges (R.A. 3765 Sec. 4) -->
  <div class="section">
    <div class="section-title">III. Finance Charges</div>
    <table class="charges-table">
      <tr>
        <td style="padding-left:16pt;">a. Interest</td>
        <td class="amt">${fmt(totalInterest > 0 ? totalInterest : 0)}</td>
      </tr>
      <tr>
        <td style="padding-left:16pt;">b. Processing / Service Fee</td>
        <td class="amt">${fmt(processingFee)}</td>
      </tr>
      <tr>
        <td style="padding-left:16pt;">c. Service Fee</td>
        <td class="amt">${fmt(serviceFee)}</td>
      </tr>
      ${otherDeductions > 0 ? `<tr>
        <td style="padding-left:16pt;">d. Other Charges</td>
        <td class="amt">${fmt(otherDeductions)}</td>
      </tr>` : ""}
      <tr class="total-row">
        <td><strong>2. Total Finance Charges</strong></td>
        <td class="amt"><strong>${fmt(totalFinanceCharges + (totalInterest > 0 ? totalInterest : 0))}</strong></td>
      </tr>
    </table>
  </div>

  <!-- Net Proceeds -->
  <div class="section">
    <div class="section-title">IV. Net Proceeds</div>
    <table class="charges-table">
      <tr>
        <td>Principal Loan Amount</td>
        <td class="amt">${fmt(principal)}</td>
      </tr>
      <tr>
        <td>Less: Upfront Deductions (Processing + Service + Other)</td>
        <td class="amt">(${fmt(totalFinanceCharges)})</td>
      </tr>
      <tr class="grand-total">
        <td><strong>3. Net Proceeds of Loan (Amount Received by Borrower)</strong></td>
        <td class="amt"><strong>${fmt(netProceeds)}</strong></td>
      </tr>
    </table>
  </div>

  <!-- Rate Information (BSP Circular 730) -->
  <div class="section">
    <div class="section-title">V. Rate Information</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2pt 20pt;">
      <div class="field-row"><span class="field-label">Contractual Interest Rate:</span><span class="field-value">${rate}% per month</span></div>
      <div class="field-row"><span class="field-label">Nominal Annual Rate:</span><span class="field-value">${annualRate.toFixed(2)}% per annum</span></div>
      <div class="field-row"><span class="field-label">Interest Computation:</span><span class="field-value">${capitalize(clean(data.interest_type)) || "Diminishing"} Balance</span></div>
      <div class="field-row"><span class="field-label">Total Amount Payable:</span><span class="field-value">${fmt(totalPayable)}</span></div>
    </div>
  </div>

  <!-- Amortization Schedule -->
  ${schedule.length ? `
  <div class="section${schedule.length > 12 ? " page-break" : ""}">
    <div class="section-title">VI. Amortization Schedule</div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">No.</th>
          <th style="width:18%">Due Date</th>
          <th style="width:17%">Beginning Balance</th>
          <th style="width:17%">Principal</th>
          <th style="width:15%">Interest</th>
          <th style="width:15%">Total Amortization</th>
          <th style="width:13%">Outstanding Balance</th>
        </tr>
      </thead>
      <tbody>${scheduleRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:center; font-weight:bold;">TOTAL</td>
          <td class="num">${fmt(totals.principal)}</td>
          <td class="num">${fmt(totals.interest)}</td>
          <td class="num">${fmt(totals.amount_due)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>` : ""}

  <!-- Borrower Acknowledgment (Required by R.A. 3765) -->
  <div class="section legal-text" style="margin-top:20pt;">
    <p><strong>ACKNOWLEDGMENT:</strong> I/We acknowledge receipt of this Disclosure Statement <em>prior to the consummation</em> of the above credit/loan transaction. I/We have read and fully understood all the terms and conditions stated herein, including the finance charges, interest rate, penalties, and other charges.</p>
    <p>This Disclosure Statement is issued in compliance with <strong>Republic Act No. 3765</strong>, otherwise known as the <em>"Truth in Lending Act,"</em> and its implementing rules and regulations, as amended by <strong>BSP Circular No. 730, Series of 2011</strong>.</p>
  </div>

  <!-- Signatures -->
  <div class="sig-section">
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${data.borrower_name || "_______________"}</div>
        <div class="sig-label">Borrower — Signature Over Printed Name</div>
        <div class="sig-detail">Date: _______________</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Authorized Representative</div>
        <div class="sig-label">Creditor / Lending Company</div>
        <div class="sig-detail">Date: _______________</div>
      </div>
    </div>
  </div>

  <div class="footer">
    This is a system-generated Disclosure Statement. &bull; Ref: ${data.application_number ?? data.loan_id} &bull; Generated: ${today}
  </div>
</body>
</html>`;
}

// ── Promissory Note (Act No. 2031 — Negotiable Instruments Law) ──

export function generatePromissoryNoteHTML(data: LoanPromissoryNote): string {
  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });

  const principal = data.principal_amount || 0;
  const totalPayable = data.total_payable || 0;
  const rate = data.interest_rate || 0;
  const term = data.term_months || 0;
  const freq = capitalize(clean(data.payment_frequency));
  const interestMethod = capitalize(clean(data.interest_type)) || "Diminishing";
  const releaseDate = fmtDate(data.release_date);
  const maturityDate = fmtDate(data.maturity_date);
  const dateOnNote = releaseDate !== "_______________" ? releaseDate : today;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promissory Note — ${data.application_number ?? data.loan_id}</title>
  <style>${BASE_STYLES}
    .pn-body { font-size: 11pt; line-height: 1.8; text-align: justify; }
    .pn-body p { margin-bottom: 10pt; text-indent: 36pt; }
    .pn-body .u { font-weight: bold; text-decoration: underline; }
    .clause-num { display: inline-block; width: 24pt; font-weight: bold; }
  </style>
</head>
<body>
  ${TOOLBAR}

  <div class="doc-header">
    <h1>Promissory Note</h1>
    <div class="legal-ref">Act No. 2031 — Negotiable Instruments Law</div>
  </div>

  <!-- Header Fields -->
  <div style="display:flex; justify-content:space-between; margin-bottom:16pt; font-size:10.5pt;">
    <div>
      <div class="field-row"><span class="field-label">Loan Account No.:</span><span class="field-value">${data.application_number ?? data.loan_id}</span></div>
      <div class="field-row"><span class="field-label">Amount:</span><span class="field-value">${fmt(principal)}</span></div>
    </div>
    <div style="text-align:right;">
      <div class="field-row"><span class="field-label">Date:</span><span class="field-value">${dateOnNote}</span></div>
      <div class="field-row"><span class="field-label">Place:</span><span class="field-value">Philippines</span></div>
    </div>
  </div>

  <!-- Main Body — Unconditional Promise to Pay (Section 1, Act 2031) -->
  <div class="pn-body">
    <p>
      FOR VALUE RECEIVED, I/We, <span class="u">${data.borrower_name || "_______________"}</span>${data.borrower_address ? `, of legal age, Filipino, residing at <span class="u">${data.borrower_address}</span>` : ", of legal age, Filipino"},
      (hereinafter referred to as the "Maker"), jointly and severally promise to pay, without need of demand, to the order of
      the <strong>LENDER</strong>, at its principal office, the sum of
      <span class="u">${amountInWords(principal)} (${fmt(principal)})</span>,
      Philippine Currency, together with interest thereon at the rate of
      <span class="u">${rate}% per month</span>,
      computed on the basis of <span class="u">${interestMethod} Balance</span>.
    </p>

    <p>
      The total amount payable, inclusive of principal and interest, shall be
      <span class="u">${fmt(totalPayable)}</span>,
      to be paid in <span class="u">${term}</span> consecutive
      <span class="u">${freq}</span> installment(s),
      the first installment to be due and payable on <span class="u">${releaseDate}</span>
      and every ${freq.toLowerCase()} period thereafter until the full obligation, including interest, shall have been fully paid.
      The maturity date of this Note is <span class="u">${maturityDate}</span>.
    </p>
  </div>

  <!-- Standard Legal Clauses -->
  <div class="section" style="margin-top:14pt;">
    <div class="section-title">Terms and Conditions</div>
    <div class="legal-text">

      <p><span class="clause-num">1.</span> <strong>DEFAULT / PENALTY.</strong>
      In case of default in the payment of any installment or any portion thereof when due, a penalty charge shall be imposed on the amount in arrears, computed from the date of default until full payment thereof, without prejudice to the right of the holder to exercise any or all remedies available under this Note or under applicable law.</p>

      <p><span class="clause-num">2.</span> <strong>ACCELERATION.</strong>
      Time is of the essence of this Note. In case of default in the payment of any installment or any amount due hereunder, or breach of any condition or obligation under this Note or any related agreement, the entire principal balance, together with accrued interest, penalties, and other charges, shall, without need of notice or demand, immediately become due and demandable.</p>

      <p><span class="clause-num">3.</span> <strong>ATTORNEY'S FEES AND COSTS OF COLLECTION.</strong>
      In case of judicial or extrajudicial enforcement or collection of the obligation herein, I/We agree to pay attorney's fees equivalent to ten percent (10%) of the total amount due but not less than Five Thousand Pesos (PHP 5,000.00), plus costs of suit and other expenses of collection.</p>

      <p><span class="clause-num">4.</span> <strong>VENUE.</strong>
      All actions arising from or in connection with this Note shall be brought exclusively before the proper courts of the city/municipality where the Lender's principal office is located, to the exclusion of all other courts. I/We hereby waive any objection to the venue of such action or proceeding.</p>

      <p><span class="clause-num">5.</span> <strong>WAIVER.</strong>
      I/We hereby waive demand, presentment for payment, notice of non-payment, notice of dishonor, protest, and notice of protest, and agree to remain bound under this Note notwithstanding any extension of time, renewal, or modification that may be granted by the holder without my/our prior consent.</p>

      <p><span class="clause-num">6.</span> <strong>SEVERABILITY.</strong>
      If any provision of this Note is declared invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>

    </div>
  </div>

  <!-- Co-Maker Undertaking -->
  ${data.co_maker_name ? `
  <div class="section" style="margin-top:14pt;">
    <div class="section-title">Co-Maker's Undertaking</div>
    <div class="legal-text">
      <p>
        I, <span style="font-weight:bold; text-decoration:underline;">${data.co_maker_name}</span>${data.co_maker_address ? `, of legal age, Filipino, with residence at <strong>${data.co_maker_address}</strong>` : ", of legal age, Filipino"},
        for and in consideration of the loan granted to the above-named Maker/Borrower, do hereby bind myself
        <strong>jointly and severally (solidarily)</strong> with the above-named Maker/Borrower for the full and faithful payment
        of the principal obligation, including interest, penalties, attorney's fees, and other charges due under this Promissory Note.
      </p>
      <p>
        I acknowledge that as co-maker, I am <strong>primarily liable</strong> for the obligation, and the holder may proceed against me
        directly without first proceeding against the principal Maker/Borrower or exhausting any security given for the obligation.
      </p>
      <p>
        I have read and fully understood the terms and conditions of this Promissory Note and voluntarily affix my signature hereto.
      </p>
    </div>
  </div>` : ""}

  <!-- Execution -->
  <div class="legal-text" style="margin-top:16pt;">
    <p>
      IN WITNESS WHEREOF, I/We have hereunto set my/our hand(s) this <span style="font-weight:bold;">${dateOnNote}</span>, in the Philippines.
    </p>
  </div>

  <!-- Signatures -->
  <div class="sig-section">
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${data.borrower_name || "_______________"}</div>
        <div class="sig-label">Maker / Borrower</div>
        <div class="sig-detail">Address: ${data.borrower_address || "_______________"}</div>
      </div>
      ${data.co_maker_name ? `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${data.co_maker_name}</div>
        <div class="sig-label">Co-Maker</div>
        <div class="sig-detail">Address: ${data.co_maker_address || "_______________"}</div>
      </div>` : `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Authorized Representative</div>
        <div class="sig-label">Lender / Creditor</div>
      </div>`}
    </div>

    <!-- Witnesses -->
    <div style="margin-top:32pt;">
      <p style="font-size:10pt; font-weight:bold; margin-bottom:8pt;">SIGNED IN THE PRESENCE OF:</p>
      <div class="sig-grid">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Witness 1 — Signature Over Printed Name</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Witness 2 — Signature Over Printed Name</div>
        </div>
      </div>
    </div>

    <!-- Notarial Acknowledgment Section (Optional but recommended) -->
    <div style="margin-top:32pt; border: 1px solid #ccc; padding: 16pt; font-size: 9pt; page-break-inside: avoid;">
      <p style="text-align:center; font-weight:bold; font-size:10pt; margin-bottom:10pt;">ACKNOWLEDGMENT</p>
      <p style="line-height:1.6;">
        REPUBLIC OF THE PHILIPPINES&ensp;)<br>
        CITY / MUNICIPALITY OF _____________&ensp;) S.S.
      </p>
      <p style="line-height:1.6; margin-top:8pt; text-indent:24pt;">
        BEFORE ME, a Notary Public for and in the above jurisdiction, this _____ day of _______________, 20___,
        personally appeared the following:
      </p>
      <table style="width:100%; margin:10pt 0; font-size:9pt; border:none;">
        <tr style="font-weight:bold;">
          <td style="border:none; padding:4pt;">Name</td>
          <td style="border:none; padding:4pt;">Valid ID / CTC No.</td>
          <td style="border:none; padding:4pt;">Date/Place Issued</td>
        </tr>
        <tr>
          <td style="border:none; border-bottom:1px solid #000; padding:4pt;">${data.borrower_name || ""}&nbsp;</td>
          <td style="border:none; border-bottom:1px solid #000; padding:4pt;">&nbsp;</td>
          <td style="border:none; border-bottom:1px solid #000; padding:4pt;">&nbsp;</td>
        </tr>
        ${data.co_maker_name ? `<tr>
          <td style="border:none; border-bottom:1px solid #000; padding:4pt;">${data.co_maker_name}&nbsp;</td>
          <td style="border:none; border-bottom:1px solid #000; padding:4pt;">&nbsp;</td>
          <td style="border:none; border-bottom:1px solid #000; padding:4pt;">&nbsp;</td>
        </tr>` : ""}
      </table>
      <p style="line-height:1.6; text-indent:24pt;">
        known to me and to me known to be the same person(s) who executed the foregoing Promissory Note, and acknowledged to me that the same is their free and voluntary act and deed.
      </p>
      <p style="line-height:1.6; text-indent:24pt; margin-top:8pt;">
        WITNESS MY HAND AND SEAL on the date and place above written.
      </p>
      <div style="text-align:right; margin-top:24pt;">
        <div style="display:inline-block; text-align:center;">
          <div style="border-bottom:1px solid #000; width:200pt; height:24pt; margin-bottom:2pt;">&nbsp;</div>
          <div style="font-size:8pt; font-weight:bold;">NOTARY PUBLIC</div>
          <div style="font-size:7.5pt; color:#666; margin-top:4pt;">
            Until December 31, 20___<br>
            PTR No. _____ / IBP No. _____<br>
            Roll No. _____ / MCLE No. _____
          </div>
        </div>
      </div>
      <p style="font-size:8pt; color:#666; margin-top:12pt;">
        Doc. No. _____; Page No. _____; Book No. _____; Series of 20___.
      </p>
    </div>
  </div>

  <div class="footer">
    This is a system-generated Promissory Note. &bull; Ref: ${data.application_number ?? data.loan_id} &bull; Generated: ${today}
  </div>
</body>
</html>`;
}
