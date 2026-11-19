const ID = /^[0-9]{1,18}$/;

/** A record's id from its route, as the AMLA routes take it (1 to 18 digits, above 0), or null: the page answers not found. */
export function amlaRecordId(raw: unknown): number | null {
  if (typeof raw !== "string" || !ID.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
