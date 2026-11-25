/**
 * The rules the server holds the four appended Member Profile columns to
 * (`CustomerRowNormalizer`), mirrored so the pre-check says which rows it will
 * refuse before a byte is uploaded. A prediction only: the server decides, and
 * nothing here rewrites the file that is sent.
 *
 * Length is `fieldSizeProblems`' question and Member Type's vocabulary is
 * `resolveRowEnums`'; a membership number used twice in one file is the row
 * check's, since only it sees every row. What is left needs the row's dates as
 * read, which is why the caller passes them in.
 *
 * A member's two amounts, Monthly Income and Pledge Amt, are read here too, as
 * `CustomerRowNormalizer::cappedAmount()` reads them (finish run round 4): the
 * server's money rules (`./import-server-values`) refuse the row, in its
 * words, and an amount above what the member form allows is imported blank,
 * with its warning.
 */

import { canonicalMemberNumber, columnsFor, type ImportRow } from "./import-schema";
import { readCentavos } from "./import-server-values";

export interface MemberFieldProblem {
  key: string;
  /** The column's printed label. */
  label: string;
  severity: "error" | "warning";
  category: "date" | "value";
  message: string;
  /** The cell as it appears in the file. */
  raw: string;
}

export interface MemberFieldContext {
  /** `YYYY-MM-DD` each date cell was read as, by column key. Absent when unread. */
  dates: Readonly<Partial<Record<string, string>>>;
  /** Today in Manila, `YYYY-MM-DD`. */
  today: string;
  /**
   * Whether the person importing can edit members. The membership columns need
   * that on top of importing, as the server rules (`borrowers:update`).
   */
  membershipAllowed: boolean;
}

/**
 * Each amount, the most the member form allows in centavos, and that limit as
 * the server words it (`CustomerRowNormalizer`).
 */
const MEMBER_AMOUNTS: ReadonlyArray<readonly [string, bigint, string]> = [
  ["monthly_income", BigInt("9999999999"), "99,999,999.99"],
  ["pledge_amount", BigInt("999999999"), "9,999,999.99"],
];

/**
 * Today less `years`, as `Carbon::today()->subYears()` gives it: 29 February
 * overflows into 1 March in a common year.
 */
function yearsBefore(today: string, years: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const target = year - years;
  const leap = target % 4 === 0 && (target % 100 !== 0 || target % 400 === 0);
  const [m, d] = month === 2 && day === 29 && !leap ? [3, 1] : [month, day];
  return `${String(target).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The CDA membership columns. Date Hired is an ordinary member field. */
const MEMBERSHIP_KEYS = ["membership_date", "member_type", "membership_number"] as const;

/** Plain keyboard characters, once the spaces are gone (the portal's own rule). */
const PLAIN = /^[\x21-\x7E]+$/;

/**
 * Anything that starts like a member code, which the app gives out itself
 * (`BRW-000123`), look-alikes included (`BRW000123`, `BRW-00O123`).
 */
const MEMBER_CODE = /^BRW/i;

/** Digits all zero and no letters, once normalised: `0`, `000`, `00-00`. */
const ONLY_ZEROS = /^[^A-Z1-9]+$/;

function labelOf(key: string): string {
  return columnsFor("customer").find((column) => column.key === key)?.label ?? key;
}

/** Every rule a row's new columns break, in the order the server checks them. */
export function memberFieldProblems(row: ImportRow, context: MemberFieldContext): MemberFieldProblem[] {
  const problems: MemberFieldProblem[] = [];
  const cell = (key: string) => (row[key] ?? "").trim();
  const add = (key: string, severity: MemberFieldProblem["severity"], category: MemberFieldProblem["category"], message: string) =>
    problems.push({ key, label: labelOf(key), severity, category, message, raw: cell(key) });

  // The birthdate as `CustomerRowNormalizer::birthdate()` holds it, once read:
  // in the future or before 1900 it is imported blank, and under 18 it warns.
  // Both are `YYYY-MM-DD`, so the strings compare as the dates do.
  const read = context.dates.birthdate;
  let birthdate = read;
  if (read && read > context.today) {
    add("birthdate", "warning", "date", `"${read}" is in the future, which cannot be a birthdate, so it was imported as blank.`);
    birthdate = undefined;
  } else if (read && read < "1900-01-01") {
    add("birthdate", "warning", "date", `"${read}" is before 1900 and was imported as blank.`);
    birthdate = undefined;
  } else if (read && read > yearsBefore(context.today, 18)) {
    add(
      "birthdate",
      "warning",
      "date",
      `"${read}" makes this member under 18. The record was imported as-is because it is a fact on the coop's books, but the member form requires 18+, so this member cannot be saved in the app until the birthdate is corrected.`,
    );
  }

  for (const [key, mostCentavos, mostWords] of MEMBER_AMOUNTS) {
    if (!cell(key)) continue; // Both are optional.
    const reading = readCentavos(cell(key));
    if (!reading.ok) {
      add(key, "error", "value", reading.message);
    } else if (reading.value > mostCentavos) {
      add(
        key,
        "warning",
        "value",
        `This amount is above the ${mostWords} the member form allows, so it was imported as blank rather than leaving a member who cannot be saved.`,
      );
    }
  }

  // Both are `YYYY-MM-DD`, so the strings compare as the dates do. A birthdate
  // imported blank is not held against the date hired, as on the server.
  const hired = context.dates.date_hired;
  if (hired) {
    const raw = cell("date_hired");
    if (hired <= "1900-01-01") {
      add("date_hired", "error", "date", `Date Hired "${raw}" is not after 1 January 1900, so it can't be a date hired.`);
    } else if (hired > context.today) {
      add("date_hired", "error", "date", `Date Hired "${raw}" is after today, and a date hired can't be in the future.`);
    } else if (birthdate && hired < birthdate) {
      add("date_hired", "error", "date", `Date Hired "${raw}" is before this member's birthdate (${birthdate}), so it can't be the date they were hired.`);
    }
  }

  if (!context.membershipAllowed) {
    const filled = MEMBERSHIP_KEYS.find((key) => cell(key) !== "");
    if (filled) {
      add(
        filled,
        "error",
        "value",
        "Only staff who can edit members can import membership details. Leave Membership Date, Member Type and Membership Number blank, or have someone who can edit members start the import.",
      );
    }
    return problems;
  }

  const joined = context.dates.membership_date;
  if (joined && joined > context.today) {
    add("membership_date", "error", "date", `Membership Date "${cell("membership_date")}" is after today, and a membership date can't be in the future.`);
  }

  const number = cell("membership_number");
  if (number) {
    const stored = canonicalMemberNumber(number);
    // A spreadsheet placeholder (`-`, `N/A`, `0`) would become the member's
    // sign-in number, so a number needs a digit and can't be only zeros.
    if (!PLAIN.test(stored)) {
      add("membership_number", "error", "value", `Membership Number "${number}" holds a character outside plain letters, numbers and punctuation, which a membership number can't hold.`);
    } else if (MEMBER_CODE.test(stored)) {
      add("membership_number", "error", "value", `Membership Number "${number}" starts like a member code (BRW), which the app gives out itself. Leave it blank and the member's own code is used.`);
    } else if (!/\d/.test(stored)) {
      add("membership_number", "error", "value", `Membership Number "${number}" has no digits, so it reads as a spreadsheet placeholder rather than a membership number. Leave the cell blank if the member has none.`);
    } else if (ONLY_ZEROS.test(stored)) {
      add("membership_number", "error", "value", `Membership Number "${number}" is nothing but zeros, so it reads as a spreadsheet placeholder rather than a membership number. Leave the cell blank if the member has none.`);
    } else if (stored !== number.toUpperCase()) {
      add("membership_number", "warning", "value", `Membership Number "${number}" will be stored as ${stored}: members sign in with their number without spaces.`);
    }
  }

  return problems;
}
