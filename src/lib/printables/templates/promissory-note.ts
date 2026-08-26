/**
 * Promissory Note — Act No. 2031 (Negotiable Instruments Law).
 *
 * Ported from `generatePromissoryNoteHTML` in
 * `src/lib/loan-document-templates.ts`, removed in the reporting & printables
 * release; see git history for the original, which is what makes "every
 * operative sentence is unchanged" checkable. Every operative sentence is
 * carried over word for word: the unconditional promise to pay, clauses 1–6, the
 * co-maker's solidary undertaking with its primary-liability sentence, the
 * execution clause, the witness lines and the full notarial acknowledgment
 * down to the Doc./Page/Book/Series footer.
 *
 * As with the disclosure statement, the payload the API actually returns is
 * `PromissoryNoteService::generatePromissoryNote()` — nested under `borrower`,
 * `loan_terms`, `co_makers`, `payment_schedule_summary` — and not the flat
 * `LoanPromissoryNote` interface in `src/types/loan-document.ts`. Both are
 * read, nested first.
 *
 * Two data sources changed, neither of them wording:
 *   - the first installment date now comes from
 *     `payment_schedule_summary.first_due_date` instead of the release date,
 *     which is what that sentence has always claimed to state;
 *   - every co-maker on the loan gets an undertaking and a signature line, not
 *     just the first.
 *
 * The one thing this template will NOT do is fail soft into a signable
 * instrument. A blank release voucher is a form; a blank promissory note
 * carrying a full notarial acknowledgment is an incomplete negotiable
 * instrument, and Act No. 2031 s.14 lets whoever holds one fill in the blanks.
 * A rate-limited request (the API limiter is 60/min) really did produce a note
 * reading "Zero Pesos", "0% per month", no Maker and no co-makers, under a
 * complete jurat, while the app reported success. So when the payload is
 * absent the figures are blanked, the jurat is dropped, and the document says
 * DO NOT SIGN across the top.
 */

import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock, PrintSignature } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  asArray,
  asRecord,
  dateOrBlank,
  escapeHtml,
  field,
  fill,
  formatCurrency,
  generatedAt,
  humanize,
  pick,
  pickNumber,
  presentFields,
  rateLabel,
  type PrintableBuildOptions,
} from "./shared";

interface Party {
  name: string | null;
  address: string | null;
}

function readParty(raw: Record<string, unknown> | null): Party {
  return {
    name: pick<string>(raw, ["full_name", "name"]),
    address: pick<string>(raw, ["address", "street_address"]),
  };
}

/**
 * The notarial acknowledgment, as plain text.
 *
 * `notarial.body` is the one block the renderer escapes and line-breaks rather
 * than passing through as markup, so the jurat is authored here as text. That
 * is also why the appearance list is one labelled line per person instead of a
 * table: the document is set in a proportional serif, where padded text columns
 * would not line up anyway.
 *
 * It stays a single block on purpose. A jurat is one legal instrument, and the
 * renderer keeps a `notarial` block off a page break — splitting it across
 * paragraphs would let the seal land on a page of its own.
 */
function notarialBody(parties: Party[]): string {
  const appearances = (parties.length > 0 ? parties : [{ name: null, address: null }])
    .flatMap((party) => [
      `Name: ${party.name ?? BLANK_LINE}`,
      "Valid ID / CTC No.: ______________________    Date/Place Issued: ______________________",
      "",
    ]);

  return [
    "ACKNOWLEDGMENT",
    "",
    "REPUBLIC OF THE PHILIPPINES )",
    "CITY / MUNICIPALITY OF _____________ ) S.S.",
    "",
    "BEFORE ME, a Notary Public for and in the above jurisdiction, this _____ day of " +
      "_______________, 20___, personally appeared the following:",
    "",
    ...appearances,
    "known to me and to me known to be the same person(s) who executed the foregoing " +
      "Promissory Note, and acknowledged to me that the same is their free and voluntary " +
      "act and deed.",
    "",
    "WITNESS MY HAND AND SEAL on the date and place above written.",
    "",
    "____________________________",
    "NOTARY PUBLIC",
    "Until December 31, 20___",
    "PTR No. _____ / IBP No. _____",
    "Roll No. _____ / MCLE No. _____",
    "",
    "Doc. No. _____; Page No. _____; Book No. _____; Series of 20___.",
  ].join("\n");
}

export function buildPromissoryNoteDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const root = asRecord(raw);
  /** The loan could not be read: nothing below may state a figure or a party. */
  const incomplete = root === null;
  const terms = asRecord(pick(root, ["loan_terms", "terms"])) ?? root;
  const scheduleSummary = asRecord(pick(root, ["payment_schedule_summary"]));

  const borrower = readParty(asRecord(pick(root, ["borrower"])));
  // Legacy flat aliases, used when the payload is the old shape.
  const maker: Party = {
    name: borrower.name ?? pick<string>(root, ["borrower_name"]),
    address: borrower.address ?? pick<string>(root, ["borrower_address"]),
  };

  const coMakerRecords = asArray(pick(root, ["co_makers"]));
  const coMakers: Party[] =
    coMakerRecords.length > 0
      ? coMakerRecords.map(readParty)
      : pick(root, ["co_maker_name"])
        ? [
            {
              name: pick<string>(root, ["co_maker_name"]),
              address: pick<string>(root, ["co_maker_address"]),
            },
          ]
        : [];

  const accountNumber =
    pick(terms, ["loan_account_number", "application_number"]) ??
    pick(root, ["reference_number", "application_number", "loan_id"]);
  // Null rather than 0. "the sum of Zero Pesos (P0.00)" is a promise to pay
  // nothing printed in the operative sentence of a negotiable instrument; a
  // rule to be completed is a form.
  const principal = pickNumber(terms, ["principal_amount", "principal"]);
  const rate = pickNumber(terms, ["interest_rate", "rate"]);
  const term = pickNumber(terms, ["term", "term_months"]);
  const interestMethod =
    humanize(pick(terms, ["interest_method", "interest_type"])) ?? "Diminishing";
  // Raw for the rate phrase, humanized for prose — see `disclosure.ts`.
  const rawFrequency = pick(terms, ["frequency", "payment_frequency"]);
  const frequency = humanize(rawFrequency);
  const totalPayable = pickNumber(terms, ["total_obligation", "total_payable"]);

  const dateOnNote = dateOrBlank(
    pick(terms, ["start_date", "release_date", "released_at"]) ??
      pick(root, ["release_date"])
  );
  const firstDueDate = dateOrBlank(
    pick(scheduleSummary, ["first_due_date"]) ??
      pick(terms, ["start_date", "release_date"])
  );
  const maturityDate = dateOrBlank(pick(terms, ["maturity_date", "end_date"]));
  const installments =
    pickNumber(scheduleSummary, ["number_of_installments"]) ?? term;

  // Lower-cased inside "and every ___ period thereafter". Falls back to the
  // blank rather than to a guess at the loan's frequency.
  const frequencyWord = frequency ? frequency.toLowerCase() : BLANK_LINE;

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Promissory Note",
      subtitle: incomplete ? "DATA UNAVAILABLE — DO NOT SIGN" : undefined,
      legalRef: "Act No. 2031 — Negotiable Instruments Law",
    },
  ];

  if (incomplete) {
    blocks.push({
      kind: "paragraph",
      align: "center",
      html:
        // &nbsp; between the words: HTML collapses the double spaces that keep
        // "DO NOT SIGN" from reading as one word.
        "<strong>*** D O &nbsp;N O T &nbsp;S I G N ***</strong><br>" +
        "The loan record could not be retrieved when this note was printed, so the amount, " +
        "rate, term and parties are blank. <strong>Do not execute or notarise this " +
        "document.</strong> An instrument signed with blanks may be completed by whoever " +
        "holds it. Retrieve the loan and print the note again.",
    });
  }

  blocks.push(
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Loan Account No.", accountNumber),
        field("Date", dateOnNote === BLANK_LINE ? null : dateOnNote),
        field("Amount", principal === null ? null : formatCurrency(principal)),
        field("Place", "Philippines"),
      ]),
    },
    {
      kind: "paragraph",
      html:
        `FOR VALUE RECEIVED, I/We, ${fill(maker.name)}` +
        (maker.address
          ? `, of legal age, Filipino, residing at ${fill(maker.address)}`
          : ", of legal age, Filipino") +
        ", (hereinafter referred to as the &quot;Maker&quot;), jointly and severally promise to pay, " +
        "without need of demand, to the order of the <strong>LENDER</strong>, at its principal office, " +
        `the sum of ${fill(
          principal === null
            ? null
            : `${amountInWords(principal)} (${formatCurrency(principal)})`
        )}, ` +
        // "per month" was written into this sentence whatever the loan's
        // frequency was, so a daily loan promised to pay 1% a month. The rate
        // the Note states must be the rate the schedule charges.
        `Philippine Currency, together with interest thereon at the rate of ${fill(rateLabel(rate, rawFrequency))}, ` +
        `computed on the basis of ${fill(`${interestMethod} Balance`)}.`,
    },
    {
      kind: "paragraph",
      html:
        "The total amount payable, inclusive of principal and interest, shall be " +
        `${fill(totalPayable === null ? null : formatCurrency(totalPayable))}, to be paid in ` +
        `${fill(installments === null ? null : String(installments))} consecutive ` +
        `${fill(frequency)} installment(s), the first installment to be due and payable on ` +
        `${fill(firstDueDate === BLANK_LINE ? null : firstDueDate)} and every ` +
        `${escapeHtml(frequencyWord)} period thereafter until the full obligation, including ` +
        "interest, shall have been fully paid. The maturity date of this Note is " +
        `${fill(maturityDate === BLANK_LINE ? null : maturityDate)}.`,
    },
    { kind: "heading", text: "Terms and Conditions" },
    {
      kind: "paragraph",
      html:
        "<strong>1. DEFAULT / PENALTY.</strong> In case of default in the payment of any installment " +
        "or any portion thereof when due, a penalty charge shall be imposed on the amount in arrears, " +
        "computed from the date of default until full payment thereof, without prejudice to the right " +
        "of the holder to exercise any or all remedies available under this Note or under applicable law.",
    },
    {
      kind: "paragraph",
      html:
        "<strong>2. ACCELERATION.</strong> Time is of the essence of this Note. In case of default in " +
        "the payment of any installment or any amount due hereunder, or breach of any condition or " +
        "obligation under this Note or any related agreement, the entire principal balance, together " +
        "with accrued interest, penalties, and other charges, shall, without need of notice or demand, " +
        "immediately become due and demandable.",
    },
    {
      kind: "paragraph",
      html:
        "<strong>3. ATTORNEY'S FEES AND COSTS OF COLLECTION.</strong> In case of judicial or " +
        "extrajudicial enforcement or collection of the obligation herein, I/We agree to pay attorney's " +
        "fees equivalent to ten percent (10%) of the total amount due but not less than Five Thousand " +
        "Pesos (PHP 5,000.00), plus costs of suit and other expenses of collection.",
    },
    {
      kind: "paragraph",
      html:
        "<strong>4. VENUE.</strong> All actions arising from or in connection with this Note shall be " +
        "brought exclusively before the proper courts of the city/municipality where the Lender's " +
        "principal office is located, to the exclusion of all other courts. I/We hereby waive any " +
        "objection to the venue of such action or proceeding.",
    },
    {
      kind: "paragraph",
      html:
        "<strong>5. WAIVER.</strong> I/We hereby waive demand, presentment for payment, notice of " +
        "non-payment, notice of dishonor, protest, and notice of protest, and agree to remain bound " +
        "under this Note notwithstanding any extension of time, renewal, or modification that may be " +
        "granted by the holder without my/our prior consent.",
    },
    {
      kind: "paragraph",
      html:
        "<strong>6. SEVERABILITY.</strong> If any provision of this Note is declared invalid or " +
        "unenforceable, the remaining provisions shall continue in full force and effect.",
    }
  );

  if (coMakers.length > 0) {
    blocks.push({ kind: "heading", text: "Co-Maker's Undertaking" });
    // One undertaking per co-maker, each in the singular voice the clause was
    // written in, rather than one paragraph rewritten to cover several people.
    for (const coMaker of coMakers) {
      blocks.push(
        {
          kind: "paragraph",
          html:
            `I, ${fill(coMaker.name)}` +
            (coMaker.address
              ? `, of legal age, Filipino, with residence at ${fill(coMaker.address)}`
              : ", of legal age, Filipino") +
            ", for and in consideration of the loan granted to the above-named Maker/Borrower, do " +
            "hereby bind myself <strong>jointly and severally (solidarily)</strong> with the " +
            "above-named Maker/Borrower for the full and faithful payment of the principal obligation, " +
            "including interest, penalties, attorney's fees, and other charges due under this " +
            "Promissory Note.",
        },
        {
          kind: "paragraph",
          html:
            "I acknowledge that as co-maker, I am <strong>primarily liable</strong> for the obligation, " +
            "and the holder may proceed against me directly without first proceeding against the " +
            "principal Maker/Borrower or exhausting any security given for the obligation.",
        },
        {
          kind: "paragraph",
          html:
            "I have read and fully understood the terms and conditions of this Promissory Note and " +
            "voluntarily affix my signature hereto.",
        }
      );
    }
  }

  blocks.push({
    kind: "paragraph",
    html:
      "IN WITNESS WHEREOF, I/We have hereunto set my/our hand(s) this " +
      `<strong>${escapeHtml(dateOnNote)}</strong>, in the Philippines.`,
  });

  const signatories: PrintSignature[] = [
    {
      name: maker.name,
      label: "Maker / Borrower",
      detail: `Address: ${maker.address ?? BLANK_LINE}`,
    },
  ];
  if (coMakers.length > 0) {
    for (const coMaker of coMakers) {
      signatories.push({
        name: coMaker.name,
        label: "Co-Maker",
        detail: `Address: ${coMaker.address ?? BLANK_LINE}`,
      });
    }
  } else {
    signatories.push({
      name: "Authorized Representative",
      label: "Lender / Creditor",
    });
  }

  blocks.push(
    { kind: "signatures", columns: 2, blocks: signatories },
    {
      kind: "signatures",
      title: "SIGNED IN THE PRESENCE OF:",
      columns: 2,
      blocks: [
        { label: "Witness 1 — Signature Over Printed Name" },
        { label: "Witness 2 — Signature Over Printed Name" },
      ],
    }
  );

  // The jurat is what turns a filled-in form into a notarised instrument, so
  // it is printed only when there is an instrument to notarise.
  if (incomplete) {
    blocks.push({
      kind: "note",
      text:
        "NOT AN INSTRUMENT — the notarial acknowledgment is deliberately omitted from this " +
        "copy because the loan it refers to could not be read. Do not sign, witness or " +
        "notarise it.",
    });
  } else {
    blocks.push({ kind: "notarial", body: notarialBody([maker, ...coMakers]) });
  }

  return {
    id: "promissory_note",
    org: options.org ?? BLANK_ORG,
    title: "Promissory Note",
    // The API mints `PN-…` from the application number. Reusing it keeps a
    // reprint quoting the reference the note was first issued under.
    reference: pick<string>(root, ["reference_number"]) ?? undefined,
    generatedAt: generatedAt(options.now),
    blocks,
    incomplete: incomplete || undefined,
    footerNote: incomplete
      ? "DATA UNAVAILABLE — NOT A PROMISSORY NOTE. DO NOT SIGN."
      : accountNumber
        ? `This is a system-generated Promissory Note. • Loan ${accountNumber}`
        : "This is a system-generated Promissory Note.",
  };
}
