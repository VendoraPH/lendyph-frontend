/**
 * Date Hired as the server checks a member's (`HasBorrowerRules`, `date_hired`:
 * `date_format:Y-m-d`, `after:1900-01-01`, `before_or_equal:today` and not
 * before the birthdate), in the server's own words, so the member forms refuse
 * it before saving exactly as a save would (finish run round 5). Used by Add
 * and Edit Member and by the public registration.
 *
 * Every date here is `YYYY-MM-DD`, so the strings compare as the dates do.
 */

import { isCalendarDate } from "@/lib/calendar-date";

const FORMAT = "The date hired must be a date written as year-month-day, such as 2020-06-01.";
/** Laravel's own `after` message, which the server sends for this field. */
const TOO_EARLY = "The date hired field must be a date after 1900-01-01.";
const FUTURE = "The date hired cannot be in the future.";
const BEFORE_BIRTHDATE = "The date hired cannot be before the birthdate.";

/** A date hired must fall after this day. */
const NOT_AFTER = "1900-01-01";

/**
 * The server's first refusal of `dateHired`, or null when it would take it. A
 * blank date hired is fine (it's optional), and without a birthdate written
 * year-month-day there is nothing to compare it with. `today` is Manila's
 * (`todayISO()`), as the server's.
 */
export function dateHiredError(dateHired: string, birthdate: string, today: string): string | null {
  const hired = dateHired.trim();
  if (hired === "") return null;
  if (!isCalendarDate(hired)) return FORMAT;
  if (hired <= NOT_AFTER) return TOO_EARLY;
  if (hired > today) return FUTURE;
  if (isCalendarDate(birthdate) && hired < birthdate) return BEFORE_BIRTHDATE;
  return null;
}
