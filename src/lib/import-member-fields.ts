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
 */

import { canonicalMemberNumber, columnsFor, type ImportRow } from "./import-schema";

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

/** The CDA membership columns. Date Hired is an ordinary member field. */
const MEMBERSHIP_KEYS = ["membership_date", "member_type", "membership_number"] as const;

/** Plain keyboard characters, once the spaces are gone (the portal's own rule). */
const PLAIN = /^[\x21-\x7E]+$/;

/** The member-code form the app gives out itself, `BRW-000123`. */
const MEMBER_CODE = /^BRW-\d+$/;

function labelOf(key: string): string {
  return columnsFor("customer").find((column) => column.key === key)?.label ?? key;
}

/** Every rule a row's new columns break, in the order the server checks them. */
export function memberFieldProblems(row: ImportRow, context: MemberFieldContext): MemberFieldProblem[] {
  const problems: MemberFieldProblem[] = [];
  const cell = (key: string) => (row[key] ?? "").trim();
  const add = (key: string, severity: MemberFieldProblem["severity"], category: MemberFieldProblem["category"], message: string) =>
    problems.push({ key, label: labelOf(key), severity, category, message, raw: cell(key) });

  // Both are `YYYY-MM-DD`, so the strings compare as the dates do.
  const hired = context.dates.date_hired;
  const birthdate = context.dates.birthdate;
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
    if (!PLAIN.test(stored)) {
      add("membership_number", "error", "value", `Membership Number "${number}" holds a character outside plain letters, numbers and punctuation, which a membership number can't hold.`);
    } else if (MEMBER_CODE.test(stored)) {
      add("membership_number", "error", "value", `Membership Number "${number}" reads as a member code, which the app gives out itself. Leave it blank and the member's own code is used.`);
    } else if (stored !== number.toUpperCase()) {
      add("membership_number", "warning", "value", `Membership Number "${number}" will be stored as ${stored}: members sign in with their number without spaces.`);
    }
  }

  return problems;
}
